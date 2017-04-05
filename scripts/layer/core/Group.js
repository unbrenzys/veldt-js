'use strict';

const EventEmitter = require('events');
const defaultTo = require('lodash/defaultTo');
const reduce = require('lodash/reduce');

const configureLayer = function(group, layer) {
	layer.hidden = group.hidden;
	layer.muted = group.muted;
	layer.zIndex = group.zIndex;
};

class Group extends EventEmitter {

	constructor(options = {}) {
		super();
		this.hidden = defaultTo(options.hidden, false);
		this.muted = defaultTo(options.muted, false);
		this.opacity = defaultTo(options.opacity, 1.0);
		this.zIndex = defaultTo(options.zIndex, 0);
		this.layers = defaultTo(options.layers, []);
		this.layers.forEach(layer => {
			configureLayer(this, layer);
		});
	}

	onAdd(plot) {
		if (!plot) {
			throw 'No plot argument provided';
		}
		this.plot = plot;
		this.layers.forEach(layer => {
			plot.addLayer(layer);
		});
		return this;
	}

	onRemove(plot) {
		if (!plot) {
			throw 'No plot argument provided';
		}
		this.layers.forEach(layer => {
			plot.removeLayer(layer);
		});
		this.plot = null;
		return this;
	}

	add(layer) {
		if (!layer) {
			throw 'No layer argument provided';
		}
		if (this.layers.indexOf(layer) !== -1) {
			throw 'Provided layer is already attached to the group';
		}
		configureLayer(this, layer);
		this.layers.push(layer);
		if (this.plot) {
			this.plot.addLayer(layer);
		}
		return this;
	}

	remove(layer) {
		if (!layer) {
			throw 'No layer argument provided';
		}
		const index = this.layers.indexOf(layer);
		if (index === -1) {
			throw 'Provided layer is not attached to the group';
		}
		this.layers.splice(index, 1);
		if (this.plot) {
			this.plot.removeLayer(layer);
		}
		return this;
	}

	has(layer) {
		const index = this.layers.indexOf(layer);
		return index !== -1;
	}

	show() {
		this.hidden = false;
		this.layers.forEach(layer => {
			layer.show();
		});
		return this;
	}

	hide() {
		this.hidden = true;
		this.layers.forEach(layer => {
			layer.hide();
		});
		return this;
	}

	isHidden() {
		return this.hidden;
	}

	mute() {
		this.muted = true;
		this.layers.forEach(layer => {
			layer.mute();
		});
		return this;
	}

	unmute() {
		if (this.muted) {
			this.muted = false;
			this.layers.forEach(layer => {
				layer.unmute();
			});
			if (this.plot) {
				// get visible coords
				const coords = this.plot.getTargetVisibleCoords();
				// request tiles
				this.layers.forEach(layer => {
					layer.requestTiles(coords);
				});
			}
		}
		return this;
	}

	isMuted() {
		return this.muted;
	}

	enable() {
		this.show();
		this.unmute();
		return this;
	}

	disable() {
		this.hide();
		this.mute();
		return this;
	}

	isDisabled() {
		return this.muted && this.hidden;
	}

	setZIndex(index) {
		this.zIndex = index;
		this.layers.forEach(layer => {
			layer.setZIndex(index);
		});
	}

	setOpacity(opacity) {
		this.opacity = Math.max(0, Math.min(opacity, 1.0)); //[0,1];
		this.layers.forEach(layer => {
			layer.setOpacity(opacity);
		});
	}

	isFiltered() {
		return reduce(this.layers, (result, layer) => {
			return result || layer.isFiltered();
		}, false);
	}

	addFilter(id, filter) {
		this.layers.forEach(layer => {
			layer.addFilter(id, filter);
		});
	}

	removeFilter(id) {
		this.layers.forEach(layer => {
			layer.removeFilter(id);
		});
	}

	clearFilters() {
		this.layers.forEach(layer => {
			layer.clearFilters();
		});
	}

	setQuery(query) {
		this.layers.forEach(layer => {
			layer.setQuery(query);
		});
	}

	clearQuery() {
		this.layers.forEach(layer => {
			layer.clearQuery();
		});
	}

	refresh() {
		this.layers.forEach(layer => {
			layer.refresh();
		});
	}

	draw() {
		// no-op
	}

	requestTiles() {
		// no-op
	}
}

module.exports = Group;
