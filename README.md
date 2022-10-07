# message-relay-websocket


A wrapper of message-relay-services allowing for websocket use on the server and in the client.


## Install

```
npm install -s message-relay-websocket
```

For web builder contexts:


```
npm install -save-dev message-relay-websocket
```

## Overview

As of 10/2022: This documentation is just getting started and the supporting package documentation is still being improved. Never-the-less, refering to the documentation in [message-relay-services](https://www.npmjs.com/package/message-relay-services)

### Purpose

The aim of this package is to provide the same interface to communication offered by [message-relay-services](https://www.npmjs.com/package/message-relay-services) on top of a websocket implementation.

### Overview of Classes

This package exposes three classes for use on the server side, two server types and one client type. On the browser side, this package exposes one client class implementing the MessageRelay class functionality. Here are the classes given as a list:

* **WSMessageRelayer**
* **WSServeMessageEndpoint**
* **WSServeMessageRelay**
* **WSMessageRelayer** (browser)


### Dependencies

This package depends on other packages for websocket implementations. At the present time, the node.js package requires **ws**.

The package **ws** is in the dependencies list in the package's package.json file.

## Examples

Within the test directory of this module are a few examples of this packages' use.

Here is a simple endpoint server:

```
const WSEndpoint = require('../lib/ws_endpoint')

// WSEndpoint gives the server a pub/sub interlink and allows for
// more specific kinds of messages to go to its application 
// message handler

class WSTestEndpoint extends WSEndpoint {

    constructor(conf) {
        super(conf)
        this.init_subscriptions()
    }

    init_subscriptions() {
    	// adding this topic here allows for the endpoint 
    	// server to capture or process requests going through
       this.add_to_topic("oranges",'self',false)
    }

    async app_message_handler(msg_obj) {
        let op = msg_obj._tx_op
        let result = "OK"
        //
        return({ "status" : result, "explain" : `${op} performed`, "when" : Date.now() })
    }

    app_generate_tracking(p_obj) {
        if ( p_obj._tracking === undefined ) {
            p_obj._tracking = p_obj.ucwid + '-' + Date.now()
        }
        return p_obj._tracking
    }
    
    app_subscription_handler(topic,msg_obj) { }

    app_publication_pre_fan_response(topic,msg_obj,ignore) {}

}

.... 

// At some point an instance is created, which causes the program
// to start serving messages.

// my_test_conf has been created

let total_app = new WSTestEndpoint(my_test_conf);

```

This server can handle a large enough number of clients that can then subscribe to and publish messages through this server. The clients can be node.js apps or a web page in the browser.

Here is a node.js application that handles pub/sub through the server above:

```
const {WSMessageRelayer} = require('message-relay-websocket')

const SERVER_PORT = ???  // from the server configuration

// Some strings that identify this client to others
let my_label = process.argv[2]
if ( my_label === undefined ) {
    my_label = "no-label"
}

// This app will wait a few seconds before publishing
let my_secs = process.argv[3]
if ( my_secs === undefined ) {
    my_secs = 2
} else my_secs = parseFloat(my_secs)

// a waiting function...
function sleeper(secs) {
    let ticks = Math.floor(Math.round(secs*1000))
    return new Promise((resolve,reject) => {
        setTimeout(() => { resolve(true) }, ticks )
    })
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

let relayer = new WSMessageRelayer({
    "port" : SERVER_PORT,
    "address" : "localhost"
})

// notice the topic 'oranges' and the pathway 'fruit'
// topic and path have to be the same on all clients for messages
// to go into them

relayer.on('client-ready',async () => {
    let status = await relayer.subscribe('oranges','fruit',(message) => {
        console.log(my_label + "::  got publication")
        console.dir(message,null,2)
    })
    console.log(`subscription status: ${status}`)
    console.dir(status,null,2)
    console.log("sleeping")
    await sleeper(my_secs)
    console.log("SLEPT")
    // PUBLISH !!!!
    relayer.publish('oranges','fruit',{
        "message" : ("this is a test from: " + my_label)
    })
})

```


Here is a version for the browser:

```
//
import {WSMessageRelayer} from 'message-relay-websocket'

const my_label = "test-web-page"
const my_secs = Math.round(Math.random()*100)
my_secs = my_secs > 30 ? Math.trunc(my_secs/10) : my_secs


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

let relayer = new WSMessageRelayer({
    "port" : SERVER_PORT,
    "address" : "localhost"
})

// notice the topic 'oranges' and the pathway 'fruit'
// topic and path have to be the same on all clients for messages
// to go into them

relayer.on('client-ready',async () => {

    let status = await relayer.subscribe('oranges','fruit',(publication) => {
        let message = publication.message
        let odiv = document.getElementById("get-pubs")
        odiv.innerText = message
    })
    //
    console.log(`subscription status: ${status}`)
	//
    console.log("sleeping")
    await sleeper(my_secs)
    console.log("SLEPT")
    // PUBLISH !!!!
    let response = await relayer.publish('oranges','fruit',{
        "message" : "THIS IS FROM THE WEB PAGE"
    })
    console.log(response)
})


```



## Issues

Please discuss issues on GitHub.


