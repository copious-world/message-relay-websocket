


let my_label = process.argv[2]
if ( my_label === undefined ) {
    my_label = "no-label"
}

let my_secs = process.argv[3]
if ( my_secs === undefined ) {
    my_secs = 2
} else my_secs = parseFloat(my_secs)


const WSClient = require('../lib/ws_client')




let test_client = new WSClient({
    "port" : 9797,
    "address" : "localhost"
})


function sleeper(secs) {
    let ticks = Math.floor(Math.round(secs*1000))
    return new Promise((resolve,reject) => {
        setTimeout(() => { resolve(true) }, ticks )
    })
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

test_client.on('client-ready',async () => {
    let status = await test_client.subscribe('oranges','fuit',(message) => {
        console.log(my_label + "::  got publication")
        console.dir(message,null,2)
    })
    console.log(`subscription status: ${status}`)
    console.dir(status,null,2)
    console.log("sleeping")
    await sleeper(my_secs)
    console.log("SLEPT")
    test_client.publish('oranges','fuit',{
        "message" : ("this is a test from: " + my_label)
    })
})

