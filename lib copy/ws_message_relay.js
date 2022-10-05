
// Import the communicator that will be used to field the messages...
const {MessengerCommunicator} = require('message-relay-services')
const {WebSocketServer} = require('ws')




const EventEmitter = require('events')


class WSWriter extends EventEmitter {

    constructor(ws) {
        super()
        this.ws = ws
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



// ~60 lines
class WSMessageRelayer extends MessengerCommunicator {
    //
    constructor(conf,fanoutRelayer) {
        super(conf,fanoutRelayer)
        this.use_ws = conf.ws_options ? true : false
        this.ws_conf = this.use_ws ? conf.ws_options : false
        this.wss = false
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    _init_members(conf) {
        super._init_members(conf)
        //

    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //


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
        //
        if ( this.use_ws ) {
            this.wss = new WebSocketServer( this.ws_conf )
            this.wss.on('connection',(ws,req) => { this.onWSConnected_func(ws,req) })
        }

        super._create_connection()  // allow the service to run with more than just tcp if desired
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    _init(conf) {
        //
        if ( conf === undefined ) {
            console.log("message relay client: cannot initialize -- no configuration")
            return;
        }
        //
        this._init_members(conf)
        this._create_connection()
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

}



module.exports = WSMessageRelayer
