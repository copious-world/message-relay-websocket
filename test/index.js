const WSEndpoint = require('../lib/ws_endpoint')

const fs = require('fs')
const {spawn} = require('child_process')




class WSTestEndpoint extends WSEndpoint {

    // 
    constructor(conf) {
        super(conf)
        //
        this.init_subscriptions()
    }



    init_subscriptions() {
        this.add_to_topic("oranges",'self',false)
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    async app_message_handler(msg_obj) {
        let op = msg_obj._tx_op
        let result = "OK"
        //
        return({ "status" : result, "explain" : `${op} performed`, "when" : Date.now() })
    }



    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // ----
    app_generate_tracking(p_obj) {
        if ( p_obj._tracking === undefined ) {
            p_obj._tracking = p_obj.ucwid + '-' + Date.now()
        }
        return p_obj._tracking
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // app_subscription_handler
    //  -- Handle state changes...
    // this is the handler for the topics added directory above in the constructor  -- called post publication by endpoint in send_to_all
    app_subscription_handler(topic,msg_obj) {
        //
        console.log("procssing a message")
        console.dir(msg_obj,null,2)
    }


    app_publication_pre_fan_response(topic,msg_obj,ignore) {
        if ( topic === REQUEST_EVENT_TOPIC ) {
            this.user_manage_date('C',msg_obj)
            this.app_generate_tracking(msg_obj)
        } else if ( topic === REQUEST_EVENT_CHANGE_TOPIC ) {
            this.user_manage_date('U',msg_obj) 
        } else if ( topic === REQUEST_EVENT_DROP_TOPIC ) {
            this.user_manage_date('D',msg_obj) 
        }
    }

    // ---- user_manage_date
    // ---- ---- ---- ----   always call this before writing the file... The parent class should be like this.
    user_manage_date(op,u_obj) {
        switch ( op ) {
            case 'C' : {
                u_obj.dates = {         // creating the object... perhaps this overwrites something. But, as far as these services go, this is where this starts
                    "created" : Date.now(),
                    "updated" : Date.now()
                }
                break;
            }
            case 'U' :
            default: {  // until someone thinks of another default
                if ( u_obj.dates === undefined ) {  /// really it should be defined by the time this gets here... but maybe someone dropped something in a directory
                    u_obj.dates = {         // creating the object... perhaps this overwrites something. But, as far as these services go, this is where this starts
                        "created" : Date.now(),
                        "updated" : Date.now()
                    }    
                } else {
                    u_obj.dates.updated = Date.now()
                    if ( u_obj.dates.created === undefined ) {       // in the event that the object is messed up somehow
                        u_obj.dates.created = Date.now()
                    }
                }
                break;
            }
        }
    }


}





let conf_file = './test/test-service.conf'
let conf_par = process.argv[2]
if ( conf_par !== undefined ) {
    conf_file = conf_par
}

let conf = JSON.parse(fs.readFileSync(conf_file).toString())
let endpoint = conf

console.log(`Contact Server: PORT: ${endpoint.ws_options.port} ADDRESS: ${endpoint.ws_options.address}`)

new WSTestEndpoint(endpoint.ws_options)

let sp1 = spawn('node',["./test/client","AAA",1.5])
sp1.stdout.on('data',data => {
    console.log(data.toString())
})
sp1.on('close',(code) => {
    console.log("CODE " + code)
})

let sp2 = spawn('node',["./test/client","BBB",2])
sp2.stdout.on('data',data => {
    console.log(data.toString())
})

let sp3 = spawn('node',["./test/client","CCC",1])
sp3.stdout.on('data',data => {
    console.log(data.toString())
})