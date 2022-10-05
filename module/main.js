'use strict';

import {Communicator} from './browser-communicator'

class BubbleGum extends Communicator {
    constructor(conf,wrapper,skip_init) {
        super(conf,wrapper,skip_init)
    }
}

module.exports = BubbleGum;
