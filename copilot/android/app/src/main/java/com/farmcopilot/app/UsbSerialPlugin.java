package com.farmcopilot.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

import java.io.IOException;
import java.util.List;

@CapacitorPlugin(name = "UsbSerial")
public class UsbSerialPlugin extends Plugin implements SerialInputOutputManager.Listener {
    private static final String TAG = "UsbSerialPlugin";
    private static final String ACTION_USB_PERMISSION = "com.farmcopilot.app.USB_PERMISSION";

    private UsbSerialPort usbSerialPort = null;
    private SerialInputOutputManager ioManager = null;
    private PluginCall pendingPermissionCall = null;
    private int pendingBaudRate = 9600;

    private final StringBuilder lineBuffer = new StringBuilder();

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (ACTION_USB_PERMISSION.equals(action)) {
                synchronized (this) {
                    UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        if (device != null && pendingPermissionCall != null) {
                            openDevicePort(device, pendingBaudRate, pendingPermissionCall);
                        }
                    } else {
                        if (pendingPermissionCall != null) {
                            pendingPermissionCall.reject("USB permission denied by user");
                            pendingPermissionCall = null;
                        }
                    }
                }
            }
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(usbReceiver, filter);
        }
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        ret.put("nativeUsb", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openPort(PluginCall call) {
        int baudRate = call.getInt("baudRate", 9600);
        UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);

        if (usbManager == null) {
            call.reject("USB Service not available on this device.");
            return;
        }

        List<UsbSerialDriver> availableDrivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
        if (availableDrivers.isEmpty()) {
            call.reject("No USB serial devices found. Please connect your NPK meter via OTG cable.");
            return;
        }

        UsbSerialDriver driver = availableDrivers.get(0);
        UsbDevice device = driver.getDevice();

        if (!usbManager.hasPermission(device)) {
            pendingPermissionCall = call;
            pendingBaudRate = baudRate;
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_MUTABLE : 0;
            PendingIntent permissionIntent = PendingIntent.getBroadcast(getContext(), 0, new Intent(ACTION_USB_PERMISSION), flags);
            usbManager.requestPermission(device, permissionIntent);
        } else {
            openDevicePort(device, baudRate, call);
        }
    }

    private void openDevicePort(UsbDevice device, int baudRate, PluginCall call) {
        UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        UsbSerialDriver driver = UsbSerialProber.getDefaultProber().probeDevice(device);
        if (driver == null) {
            call.reject("Could not find suitable driver for connected USB device.");
            return;
        }

        UsbDeviceConnection connection = usbManager.openDevice(driver.getDevice());
        if (connection == null) {
            call.reject("Failed to open connection to USB device.");
            return;
        }

        usbSerialPort = driver.getPorts().get(0);
        try {
            usbSerialPort.open(connection);
            usbSerialPort.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);

            ioManager = new SerialInputOutputManager(usbSerialPort, this);
            ioManager.start();

            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("device", device.getDeviceName());
            call.resolve(ret);
        } catch (IOException e) {
            Log.e(TAG, "Error opening serial port", e);
            call.reject("Error initializing serial port: " + e.getMessage());
        }
    }

    @PluginMethod
    public void closePort(PluginCall call) {
        stopSerialConnection();
        JSObject ret = new JSObject();
        ret.put("closed", true);
        call.resolve(ret);
    }

    private void stopSerialConnection() {
        if (ioManager != null) {
            ioManager.setListener(null);
            ioManager.stop();
            ioManager = null;
        }
        if (usbSerialPort != null) {
            try {
                usbSerialPort.close();
            } catch (IOException ignored) {}
            usbSerialPort = null;
        }
    }

    @Override
    public void onNewData(byte[] data) {
        String str = new String(data);
        lineBuffer.append(str);

        int idx;
        while ((idx = lineBuffer.indexOf("\n")) >= 0) {
            String line = lineBuffer.substring(0, idx).trim();
            lineBuffer.delete(0, idx + 1);

            if (!line.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("line", line);
                notifyListeners("usbData", ret);
            }
        }
    }

    @Override
    public void onRunError(Exception e) {
        Log.e(TAG, "USB Serial IO Error", e);
        JSObject ret = new JSObject();
        ret.put("error", e.getMessage());
        notifyListeners("usbError", ret);
        stopSerialConnection();
    }
}
