'use strict';

const lumo = require('lumo');
const EventType = require('../event/EventType');

const CELL_UPDATE = Symbol();
const DRAW_TIMEOUT = Symbol();
const ERASE_TIMEOUT = Symbol();
const DRAW_DEBOUNCE_MS = 400;
const ERASE_DEBOUNCE_MS = 400;
const OPACITY_TIMEOUT_MS = 40;
const OPACITY_FADE_IN_MS = 400;

const getStaleCoords = function(plot, tiles) {
	// get all currently visible tile coords
	const coords = plot.getVisibleCoords();
	const visible = new Map();
	for (let i=0; i<coords.length; i++) {
		const coord = coords[i];
		visible.set(coord.hash, coord);
	}
	// flag any coord that is not in view as stale
	const stale = new Map();
	tiles.forEach((tile, hash) => {
		if (!visible.has(hash)) {
			stale.set(hash, tile);
		}
	});
	return stale;
};

const getRenderables = function(plot, pyramid) {
	// get all currently visible tile coords
	const coords = plot.getVisibleCoords();
	// get available renderables
	const renderables = [];
	for (let i=0; i<coords.length; i++) {
		const coord = coords[i];
		const ncoord = coord.normalize();
		// check if we have the tile
		const tile = pyramid.get(ncoord);
		if (tile) {
			renderables.push({
				coord: coord,
				tile: tile
			});
		}
	}
	return renderables;
};

const drawTiles = function(renderer, container, tiles, plot, pyramid, ignoreFade = false) {
	const tileSize = plot.tileSize;
	const cell = plot.cell;
	// create document fragment
	const fragment = document.createDocumentFragment();
	// add new tiles to the DOM
	const renderables = getRenderables(plot, pyramid);
	for (let i=0; i<renderables.length; i++) {
		const renderable = renderables[i];
		const coord = renderable.coord;
		// check that the tile hasn't been added in the meantime (occurs on refresh)
		if (!tiles.has(coord.hash)) {
			// create tile element
			const elem = renderer.createTile(tileSize);
			// get tile pixel position relative to the cell
			const px = cell.project(coord.getPosition(), coord.z);
			// position tile
			renderer.positionTile(elem, px.x, px.y, tileSize);
			// make tile invisible
			if (!ignoreFade) {
				elem.style.transition = `opacity ${OPACITY_FADE_IN_MS}ms`;
				elem.style.opacity = '0.0';
			}
			// draw the tile
			renderer.drawTile(elem, renderable.tile);
			// add to the fragment
			fragment.append(elem);
			if (!ignoreFade) {
				// fade tile in
				setTimeout(() => {
					elem.style.opacity = 1.0;
				}, OPACITY_TIMEOUT_MS);
			}
			// add the tile
			tiles.set(coord.hash, {
				coord: coord,
				elem: elem
			});
		}
	}
	if (fragment.children.length > 0) {
		// append all new tiles to the container
		container.appendChild(fragment);
		// emit a postdraw event
		renderer.emit(EventType.DOM_POST_DRAW, new lumo.Event(renderables));
	}
};

const eraseTiles = function(renderer, container, tiles, plot) {
	// remove any stale tiles from DOM
	const stale = getStaleCoords(plot, tiles);
	stale.forEach((tile, hash) => {
		tiles.delete(hash);
		container.removeChild(tile.elem);
	});
};

const resetTileOffset = function(renderer, cell) {
	const tileSize = renderer.layer.plot.tileSize;
	renderer.tiles.forEach(tile => {
		// get tile pixel position relative to the cell
		const px = cell.project(tile.coord.getPosition(), tile.coord.z);
		// re-position tile
		renderer.positionTile(tile.elem, px.x, px.y, tileSize);
	});
};

/**
 * Class representing a DOM renderer.
 */
class DOMRenderer extends lumo.TileRenderer {

	/**
	 * Instantiates a new DOMRenderer object.
	 */
	constructor() {
		super();
		this.tiles = null;
		this.container = null;
		this[DRAW_TIMEOUT] = null;
		this[ERASE_TIMEOUT] = null;
		this[CELL_UPDATE] = null;
	}

	/**
	 * Executed when the layer is attached to a plot.
	 *
	 * @param {Layer} layer - The layer to attach the renderer to.
	 *
	 * @returns {DOMRenderer} The renderer object, for chaining.
	 */
	onAdd(layer) {
		super.onAdd(layer);
		// create tiles
		this.tiles = new Map();
		// create and attach handler
		this[CELL_UPDATE] = event => {
			resetTileOffset(this, event.target);
		};
		this.layer.plot.on(lumo.CELL_UPDATE, this[CELL_UPDATE]);
		// create and attach container
		this.container = this.createContainer();
		this.layer.plot.container.appendChild(this.container);
		return this;
	}

	/**
	 * Executed when the layer is removed from a plot.
	 *
	 * @param {Layer} layer - The layer to remove the renderer from.
	 *
	 * @returns {DOMRenderer} The renderer object, for chaining.
	 */
	onRemove(layer) {
		// detach and destroy handlers
		this.layer.plot.removeListener(lumo.CELL_UPDATE, this[CELL_UPDATE]);
		this[CELL_UPDATE] = null;
		// detach and destroy container
		this.layer.plot.container.removeChild(this.container);
		this.container = null;
		// remove tiles
		this.tiles = null;
		super.onRemove(layer);
		return this;
	}

	/**
	 * Create and return the DOM Element which contains the layer.
	 *
	 * @returns {Element} The layer container DOM element.
	 */
	createContainer() {
		throw '`createContainer` not implemented';
	}

	/**
	 * Create and return the DOM Element which represents an individual
	 * tile.
	 *
	 * @param {Number} size - the size of the tile, in pixels.
	 *
	 * @returns {Element} The tile DOM element.
	 */
	createTile() {
		throw '`createTile` not implemented';
	}

	/**
	 * Set the location of the DOM Element which represents an individual
	 * tile.
	 *
	 * @param {Element} tile - The tile DOM element.
	 * @param {Number} x - The x position of the tile, in pixels.
	 * @param {Number} y - The y position of the tile, in pixels.
	 * @param {Number} size - the size of the tile, in pixels.
	 *
	 * @returns {Element} The tile DOM element.
	 */
	positionTile() {
		throw '`positionTile` not implemented';
	}

	/**
	 * The draw function that is executed per frame.
	 *
	 * @returns {DOMRenderer} The renderer object, for chaining.
	 */
	draw() {
		const layer = this.layer;
		const plot = layer.plot;
		const tiles = this.tiles;
		const container = this.container;

		// get all stale coords
		const stale = getStaleCoords(plot, tiles);

		if (tiles.size > 0 && stale.size === tiles.size) {
			// all tiles are stale, remove them all
			if (this[ERASE_TIMEOUT]) {
				clearTimeout(this[ERASE_TIMEOUT]);
				this[ERASE_TIMEOUT] = null;
			}
			tiles.clear();
			container.innerHTML = '';
		} else {
			// not all tiles are stale, remove them individually
			if (!this[ERASE_TIMEOUT]) {
				this[ERASE_TIMEOUT] = setTimeout(()=> {
					// clear timeout
					this[ERASE_TIMEOUT] = null;
					// remove any stale tiles from DOM
					eraseTiles(
						this,
						this.container,
						this.tiles,
						this.layer.plot);
				}, ERASE_DEBOUNCE_MS);
			}
		}

		if (!this[DRAW_TIMEOUT]) {
			this[DRAW_TIMEOUT] = setTimeout(()=> {
				// clear the timeout
				this[DRAW_TIMEOUT] = null;
				// draw the renderables
				drawTiles(
					this,
					this.container,
					this.tiles,
					this.layer.plot,
					this.layer.pyramid,
					false);
			}, DRAW_DEBOUNCE_MS);
		}

		// determine container offset
		const delta = plot.cell.project(plot.viewport, plot.zoom);

		// scale on difference between current zoom and tile zoom.
		const tileZoom = Math.round(plot.getTargetZoom());
		const scale = Math.pow(2, tileZoom - plot.zoom);

		// update container
		container.style.transform = `translate3d(${-delta.x}px,${delta.y}px,0) scale(${scale})`;
		container.style.opacity = layer.getOpacity();
		container.style.zIndex = layer.getZIndex();

		return this;
	}

	/**
	 * Remove all rendered tiles from the DOM.
	 *
	 * @returns {DOMRenderer} The renderer object, for chaining.
	 */
	clear() {
		super.clear();
		// remove all tiles and clear the container
		if (this.container) {
			this.container.innerHTML = '';
		}
		if (this.tiles) {
			this.tiles.clear();
		}
		// clear timeouts
		if (this[DRAW_TIMEOUT]) {
			clearTimeout(this[DRAW_TIMEOUT]);
			this[DRAW_TIMEOUT] = null;
		}
		if (this[ERASE_TIMEOUT]) {
			clearTimeout(this[ERASE_TIMEOUT]);
			this[ERASE_TIMEOUT] = null;
		}
		return this;
	}

	/**
	 * Forces the renderer to discard all current DOM rendered tiles and
	 * recreate them.
	 *
	 * @param {Boolean} ignoreFade - Do not fade-in redrawn layer.
	 *
	 * @returns {DOMRenderer} The renderer object, for chaining.
	 */
	redraw(ignoreFade = false) {
		this.clear();
		// force draw
		drawTiles(
			this,
			this.container,
			this.tiles,
			this.layer.plot,
			this.layer.pyramid,
			this.layer,
			ignoreFade);
		return this;
	}

	/**
	 * The draw function that is executed per tile.
	 *
	 * @param {Element} element - The DOM Element object.
	 * @param {Tile} tile - The Tile object.
	 */
	drawTile() {
	}
}

module.exports = DOMRenderer;
