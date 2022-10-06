const {MessageRelayer} = require('message-relay-services')
const {WebSocket} = require('ws')
const EventEmitter = require('events')



const PORT = 1234;
const HOST = 'localhost';


const DEFAULT_MAX_RECONNECT = 20
const DEFAULT_RECONNECT_WAIT = 5


class WSWriter extends EventEmitter {

    constructor(ws) {
        super()
        this.ws = ws
        this.readyState = 'open'
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

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

class Client extends MessageRelayer {

    constructor(conf,wrapper) {
        super(conf,wrapper)
    }

    //
    _init(conf) {

        if ( conf === undefined ) {
            console.log("message relay client: cannot initialize -- no configuration")
            return;
        }

        this._init_members(conf)
        this._create_connection(conf)
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    _init_members(conf) {

        this.port = conf ? conf.port || PORT : PORT
        this.address = conf ? conf.address || HOST : HOST
        this.options = conf.ws_options
        this.ws_app_path = conf.ws_path ? console.ws_path : ""
        if ( this.ws_app_path[0] != '/' ) this.ws_app_path = '/' + this.ws_app_path
        //
        //
        this.send_on_reconnect = conf ? conf.send_on_reconnect || false : false
        //
        this.attempt_reconnect = false
        this.reconnect_wait = DEFAULT_RECONNECT_WAIT
        this.max_reconnect = DEFAULT_MAX_RECONNECT
        this.reconnect_count = 0
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    _create_connection(conf) {
        if ( this.files_only ) {
            (async () => { await this._setup_file_output(conf) })()
        } else {
            this.attempt_reconnect = (conf.attempt_reconnect !== undefined) ? conf.attempt_reconnect : false
            if ( this.attempt_reconnect ) {
                this._configure_reconnect(conf)
            }
            this._connect()
            this._setup_connection_handlers(this,conf)
        }
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // CONNECTION
    _connect() {
        if ( this.options ) {
            this.ws = new WebSocket(`ws://${this.address}:${this.port}${this.ws_app_path}`,this.options)
        } else {
            this.ws = new WebSocket(`ws://${this.address}:${this.port}${this.ws_app_path}`)
        }
        this.ws.on('open',() => {
            this._connection_handler()
        })
    }

    // // // // // // 

    _connection_handler() {
        this.writer = new WSWriter(this.ws)
        this.wrap_event(this.address)
        this.reconnect_count = 0
        console.log(`Client connected to: ${this.address} :  ${this.port}`);
        if ( this.files_going ) {  // then shunting had to be set to true.. file_only has to be false
            super.restore_send(this.send_on_reconnect)
        }
        this.emit('client-ready',this.address,this.port)
    }

    // SET UP CONNECTION AND HANDLERS  on('close'...) on('data'...) on('error'...)
    // _setup_connection_handlers
    //
    _setup_connection_handlers(client,conf) {
        //
        // 1. data
        this.ws.on('message',((com) => { return (data) => {
            com.client_add_data_and_react(data)
        }})(this))
        //
        //  2. close
        this.ws.on('close', ((com) => { return () => {
            this.unwrap_event(this.address)
            console.log('Client closed');
            if ( client.attempt_reconnect ) {
                client._attempt_reconnect(conf)
            }
            com.closeAll()
        }})(this));
        //
        // 3. error
        this.ws.on('error', async (err) => {
            this.unwrap_event(this.address)
            console.log(__filename)
            console.log(err);
            if ( client.attempt_reconnect ) {
                if ( client.reconnect_count < client.max_reconnect ) {
                    return;  // otherwise file shunting
                }
            }
            if ( client.file_shunting ) {
                await client._start_file_shunting(conf)
            }
        });
        //
    }


    closeAll() {
    }


}



module.exports = Client