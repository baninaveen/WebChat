var EVENTS = require('./events');

function Handlers(clientManager) {
    this.TAG = "Handlers: ";
    this.clientManager = clientManager;
    console.log(this.TAG, "initializing...");
}

Handlers.prototype.garnish = function(io) {
    io.on(EVENTS.CONNECTION, (socket) => {
        console.log("initiated connection new socket: " + socket.id)
        socket.broadcast.emit('message', "Hey you're now connected to me - says server");
        setTimeout(() => {
            console.log('mock authed')
            socket.broadcast.emit('authed', { 'room': 'abci23', 'phone': '213445' });
        }, 20000);
        socket.on('tokenRequest', (clientId) => { // clientId is different from socketId  
            if (!clientId) return; // don't generate tokens for nullable clients      
            console.log('recieved token request from: ', clientId, ' on socket: ', socket.id);
            let client = addOrUpdateClient(clientId, socket, makeToken());
            io.to(socket.id).emit('token', client.authToken); // send the token to the one who asked for it (not everyone on the internet lol)
        });

        socket.on('testAuth', (data) => {
            if (!isAuthorized(socket, data)) {
                io.to(socket.id).emit('testAuthFail', 'authToken necessary to make requests: ' + data.toString());
                return;
            }
            io.to(socket.id).emit('testAuthSuccess', 'Your token is valid');
        })
        socket.on('tokenValidate', (data) => {
            if (!isAuthorized(socket, data)) {
                io.to(socket.id).emit('authError', 'authToken necessary to make requests');
                return;
            }

            let qrcodeToken = data.message; // the qrcode is a browser's current authToken
            console.log("received request to validate: ", qrcodeToken.length, qrcodeToken);
            // find the browser associated with this code
            let browser = clients.find(c => c.authToken === qrcodeToken);
            if (!browser)
                console.log("browser with not found for token: " + qrcodeToken)
            else
                console.log("found browser with token: ", qrcodeToken);
            let mobile = clients.find(c => c.sockets.indexOf(socket) != -1); // phone
            // send the browser the phone's socket.id (room) so it can join it.
            let browserId = browser.sockets[0].id;
            console.log("browser socket Id: ", browserId)
            socket.to(browserId).emit('roomAuthed', {
                roomId: socket.id, // because this event should only be trigged by the phone
            });
        })
    });
}

module.exports = Handlers