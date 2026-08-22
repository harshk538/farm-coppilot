import http from 'http';
const server = http.createServer();
server.listen(5005, () => console.log('Listening 5005...'));
server.on('error', e => console.log('ERROR:', e));
