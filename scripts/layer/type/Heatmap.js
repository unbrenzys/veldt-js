'use strict';

const min = require('lodash/min');
const max = require('lodash/max');
const Bivariate = require('./Bivariate');
const Request = require('../request/Request');

class Heatmap extends Bivariate {

	constructor(options = {}) {
		super(options);
	}

	setRequestor(requestor) {
		this.requestTile = Request.requestArrayBuffer(requestor);
	}

	extractExtrema(data) {
		const bins = new Uint32Array(data);
		return {
			min: min(bins),
			max: max(bins)
		};
	}

	getTile(name = 'heatmap') {
		return {
			[name]: {
				xField: this.xField,
				yField: this.yField,
				left: this.left,
				right: this.right,
				bottom: this.bottom,
				top: this.top,
				resolution: this.resolution
			}
		};
	}

}

module.exports = Heatmap;
