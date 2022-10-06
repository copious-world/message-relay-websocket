const {EndpointCommunicator} = require('message-relay-services')
const {WebSocketServer} = require('ws')


const EventEmitter = require('events')


class WSWriter extends EventEmitter {

    constructor(ws) {
        super()
        this.ws = ws
        this.readyState ='open'
    }

    //
    write(message) {
        try {
            this.ws.send(message)
        } catch(e) {
            console.log(e)
        }
    }

}


class Server extends EndpointCommunicator {

    //
    constructor(conf) {
        super(conf)
    }
    
    _init(conf) {
        this.use_ws = conf ? true : false
        this.ws_conf = this.use_ws ? conf : false
        this.wss = false
        this._create_connection()
    }

    //
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    onWSConnected_func(ws,req) {
        //                  // add_connection
        let client_name = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        let writer = new WSWriter(ws)
        this.add_connection(client_name,writer)
        //
        // 1. data
        ws.on('message',((com) => { return (data) => {
            com.add_data_and_react(client_name,data)
        }})(this))
        //
        //  2. close
        ws.on('close', ((com) => { return () => {
            com.close(client_name)
        }})(this));
        //
        // 3. error
        ws.on('error', (err) => {
            console.error(`Connection ${client_name} error: ${err.message}`);
        });
    }


    _create_connection() {
        console.log(this.ws_conf)
        //
        if ( this.use_ws ) {
            this.wss = new WebSocketServer( this.ws_conf )
            this.wss.on('connection',(ws,req) => { this.onWSConnected_func(ws,req) })
        }
        //
    }


    close(client_name) {
        console.log("connection closed " + client_name)
    }

}


module.exports = Server