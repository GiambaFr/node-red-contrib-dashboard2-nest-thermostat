<template>
    <div class="thermostat-container">
        <div ref="thermostatContainer" class="thermostat-wrapper"></div>
    </div>
</template>

<script>
export default {
    name: 'ThermostatDial',
    
    data() {
        return {
            nest: null,
            hysteresis: 0.1,
            mode: 'heat',
            awayOffset: -3
        }
    },
    
    mounted() {
        this.$nextTick(() => {
            this.initThermostat();
        });
    },
    
    methods: {
        initThermostat() {
            const self = this;
            
            if (!this.$refs.thermostatContainer) {
                console.error('Container not found');
                return;
            }
            
            // Définir les fonctions utilitaires
            const createSVGElement = (tag, attributes, appendTo) => {
                const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
                attr(element, attributes);
                if (appendTo) {
                    appendTo.appendChild(element);
                }
                return element;
            };
            
            const attr = (element, attrs) => {
                for (let i in attrs) {
                    element.setAttribute(i, attrs[i]);
                }
            };
            
            const rotatePoint = (point, angle, origin) => {
                const radians = angle * Math.PI / 180;
                const x = point[0] - origin[0];
                const y = point[1] - origin[1];
                const x1 = x * Math.cos(radians) - y * Math.sin(radians) + origin[0];
                const y1 = x * Math.sin(radians) + y * Math.cos(radians) + origin[1];
                return [x1, y1];
            };
            
            const rotatePoints = (points, angle, origin) => {
                return points.map(point => rotatePoint(point, angle, origin));
            };
            
            const pointsToPath = (points) => {
                return points.map((point, iPoint) => {
                    return (iPoint > 0 ? 'L' : 'M') + point[0] + ' ' + point[1];
                }).join(' ') + 'Z';
            };
            
            const circleToPath = (cx, cy, r) => {
                return [
                    "M", cx, ",", cy,
                    "m", 0 - r, ",", 0,
                    "a", r, ",", r, 0, 1, ",", 0, r * 2, ",", 0,
                    "a", r, ",", r, 0, 1, ",", 0, 0 - r * 2, ",", 0,
                    "z"
                ].join(' ').replace(/\s,\s/g, ",");
            };
            
            const donutPath = (cx, cy, rOuter, rInner) => {
                return circleToPath(cx, cy, rOuter) + " " + circleToPath(cx, cy, rInner);
            };
            
            const restrictToRange = (val, min, max) => {
                if (val < min) return min;
                if (val > max) return max;
                return val;
            };
            
            const roundHalf = (num) => {
                return Math.round(num * 2) / 2;
            };
            
            const roundTenth = (num) => {
                return Math.round(num * 10) / 10;
            };
            
            const setClass = (el, className, state) => {
                el.classList[state ? 'add' : 'remove'](className);
            };
            
            const str2bool = (strvalue) => {
                return (strvalue && typeof strvalue == 'string') ? (strvalue.toLowerCase() == 'true') : (strvalue == true);
            };
            
            // Classe ThermostatDial
            function ThermostatDial(targetElement, options) {
                const thermostat = this;
                
                options = options || {};
                options = {
                    targetOnCenter: options.targetOnCenter !== undefined ? options.targetOnCenter : true,
                    diameter: options.diameter || 400,
                    minValue: options.minValue || 10,
                    maxValue: options.maxValue || 30,
                    numTicks: options.numTicks || 200,
                    onSetTargetTemperature: options.onSetTargetTemperature || function() {},
                    onAwayToggle: options.onAwayToggle || function() {},
                    hysteresis: options.hysteresis !== undefined ? options.hysteresis : 0.1,
                    mode: options.mode || 'heat',
                    awayOffset: options.awayOffset !== undefined ? options.awayOffset : -3
                };
                
                const properties = {
                    tickDegrees: 300,
                    rangeValue: options.maxValue - options.minValue,
                    radius: options.diameter / 2,
                    ticksOuterRadius: options.diameter / 30,
                    ticksInnerRadius: options.diameter / 8,
                    dragLockAxisDistance: 15,
                    labels: {
                        targetLabel: 'Set',
                        ambientUnits: 'ºC'
                    }
                };
                properties.lblDialPosition = [properties.radius, properties.ticksOuterRadius - (properties.ticksOuterRadius - properties.ticksInnerRadius) / 2];
                properties.offsetDegrees = 180 - (360 - properties.tickDegrees) / 2;
                
                const state = {
                    target_temperature: options.minValue,
                    ambient_temperature: options.minValue,
                    hvac_state: false,
                    has_leaf: false,
                    away: false,
                    mode: options.mode,
                    hysteresis: options.hysteresis,
                    awayOffset: options.awayOffset,
                    lastHvacState: false
                };
                
                // Fonction pour obtenir la température effective (avec offset si away)
                function getEffectiveSetpoint() {
                    return state.away ? state.target_temperature + state.awayOffset : state.target_temperature;
                }
                
                // Fonction pour calculer l'état HVAC avec hystérésis
                function calculateHVACState() {
                    const setpoint = getEffectiveSetpoint();
                    const current = state.ambient_temperature;
                    
                    if (state.mode === 'heat') {
                        if (setpoint > current + state.hysteresis) {
                            state.hvac_state = true;
                            state.lastHvacState = true;
                        } else if (setpoint < current - state.hysteresis) {
                            state.hvac_state = false;
                            state.lastHvacState = false;
                        } else {
                            state.hvac_state = state.lastHvacState;
                        }
                    } else if (state.mode === 'cool') {
                        if (setpoint < current - state.hysteresis) {
                            state.hvac_state = true;
                            state.lastHvacState = true;
                        } else if (setpoint > current + state.hysteresis) {
                            state.hvac_state = false;
                            state.lastHvacState = false;
                        } else {
                            state.hvac_state = state.lastHvacState;
                        }
                    }
                }
                
                // Fonction pour obtenir la classe CSS de l'état visuel
                function getVisualHvacState() {
                    if (!state.hvac_state) return 'off';
                    if (state.away) return state.mode === 'heat' ? 'heating-away' : 'cooling-away';
                    return state.mode === 'heat' ? 'heating' : 'cooling';
                }
                
                // Property definitions
                Object.defineProperty(this, 'target_temperature', {
                    get: () => state.target_temperature,
                    set: (val) => {
                        state.target_temperature = restrictTargetTemperature(+val);
                        calculateHVACState();
                        render();
                    }
                });
                
                Object.defineProperty(this, 'ambient_temperature', {
                    get: () => state.ambient_temperature,
                    set: (val) => {
                        if (options.targetOnCenter)
                            state.ambient_temperature = roundHalf(+val);
                        else
                            state.ambient_temperature = roundTenth(+val);
                        calculateHVACState();
                        render();
                    }
                });
                
                Object.defineProperty(this, 'hvac_state', {
                    get: () => state.hvac_state
                });
                
                Object.defineProperty(this, 'mode', {
                    get: () => state.mode,
                    set: (val) => {
                        if (['heat', 'cool'].indexOf(val) >= 0) {
                            state.mode = val;
                            calculateHVACState();
                            render();
                        }
                    }
                });
                
                Object.defineProperty(this, 'hysteresis', {
                    get: () => state.hysteresis,
                    set: (val) => {
                        state.hysteresis = +val;
                        calculateHVACState();
                    }
                });
                
                Object.defineProperty(this, 'awayOffset', {
                    get: () => state.awayOffset,
                    set: (val) => {
                        state.awayOffset = +val;
                        calculateHVACState();
                        render();
                    }
                });
                
                Object.defineProperty(this, 'has_leaf', {
                    get: () => state.has_leaf,
                    set: (val) => {
                        state.has_leaf = !!str2bool(val);
                        render();
                    }
                });
                
                Object.defineProperty(this, 'away', {
                    get: () => state.away,
                    set: (val) => {
                        state.away = !!str2bool(val);
                        calculateHVACState();
                        render();
                    }
                });
                
                // SVG Creation
                const svg = createSVGElement('svg', {
                    width: '100%',
                    height: '100%',
                    viewBox: '0 0 ' + options.diameter + ' ' + options.diameter,
                    class: 'dial',
                    style: 'touch-action: none;'
                }, targetElement);
                
                createSVGElement('circle', {
                    cx: properties.radius,
                    cy: properties.radius,
                    r: properties.radius,
                    class: 'dial__shape'
                }, svg);
                
                createSVGElement('path', {
                    d: donutPath(properties.radius, properties.radius, properties.radius - 4, properties.radius - 8),
                    class: 'dial__editableIndicator',
                }, svg);
                
                // Ticks
                const ticks = createSVGElement('g', {
                    class: 'dial__ticks'
                }, svg);
                
                const tickPoints = [
                    [properties.radius - 1, properties.ticksOuterRadius],
                    [properties.radius + 1, properties.ticksOuterRadius],
                    [properties.radius + 1, properties.ticksInnerRadius],
                    [properties.radius - 1, properties.ticksInnerRadius]
                ];
                
                const tickPointsLarge = [
                    [properties.radius - 1.5, properties.ticksOuterRadius],
                    [properties.radius + 1.5, properties.ticksOuterRadius],
                    [properties.radius + 1.5, properties.ticksInnerRadius + 20],
                    [properties.radius - 1.5, properties.ticksInnerRadius + 20]
                ];
                
                // Tick spécial pour l'offset away (vert)
                const tickPointsAway = [
                    [properties.radius - 2, properties.ticksOuterRadius],
                    [properties.radius + 2, properties.ticksOuterRadius],
                    [properties.radius + 2, properties.ticksInnerRadius + 25],
                    [properties.radius - 2, properties.ticksInnerRadius + 25]
                ];
                
                const theta = properties.tickDegrees / options.numTicks;
                const tickArray = [];
                for (let iTick = 0; iTick < options.numTicks; iTick++) {
                    tickArray.push(createSVGElement('path', {d: pointsToPath(tickPoints)}, ticks));
                }
                
                // Tick away vert (sera positionné dynamiquement)
                const tickAwayGreen = createSVGElement('path', {
                    d: pointsToPath(tickPointsAway),
                    class: 'dial__tick--away-green'
                }, ticks);
                
                // Labels
                const lblCenter = createSVGElement('text', {
                    x: properties.radius,
                    y: properties.radius,
                    class: 'dial__lbl dial__lbl--center',
                    style: 'pointer-events: none;'
                }, svg);
                const lblCenter_text = document.createTextNode('');
                lblCenter.appendChild(lblCenter_text);
                
                const lblCenterHalf = createSVGElement('text', {
                    x: properties.radius + properties.radius / 2.5,
                    y: properties.radius - properties.radius / 8,
                    class: 'dial__lbl dial__lbl--center--half',
                    style: 'pointer-events: none;'
                }, svg);
                const lblCenterHalf_text = document.createTextNode('0');
                lblCenterHalf.appendChild(lblCenterHalf_text);
                
                const lblCenterlabel = createSVGElement('text', {
                    x: properties.radius,
                    y: properties.radius - properties.radius / 2,
                    class: 'dial__lbl dial__lbl--centerlabel',
                    style: 'pointer-events: none;'
                }, svg);
                const lblCenterlabel_text = document.createTextNode(properties.labels.targetLabel);
                lblCenterlabel.appendChild(lblCenterlabel_text);
                
                // Label pour l'offset away (affiché à côté de la température centrale)
                const lblAwayOffset = createSVGElement('text', {
                    x: properties.radius + properties.radius / 2.8,
                    y: properties.radius + properties.radius / 12,
                    class: 'dial__lbl dial__lbl--away-offset',
                    style: 'pointer-events: none;'
                }, svg);
                const lblAwayOffset_text = document.createTextNode('');
                lblAwayOffset.appendChild(lblAwayOffset_text);
                
                const lblDial = createSVGElement('text', {
                    class: 'dial__lbl dial__lbl--dial',
                    style: 'pointer-events: none;'
                }, svg);
                const lblDial_text = document.createTextNode('');
                lblDial.appendChild(lblDial_text);
                
                // Unités °C à côté de la température du dial (le "20")
                const lblDialUnitsTop = createSVGElement('text', {
                    class: 'dial__lbl dial__lbl--dial--units-top',
                    style: 'pointer-events: none;'
                }, svg);
                const lblDialUnitsTop_text = document.createTextNode('°C');
                lblDialUnitsTop.appendChild(lblDialUnitsTop_text);
                
                const lblAwayText = createSVGElement('text', {
                    x: properties.radius,
                    y: properties.radius * 1.3,
                    class: 'dial__lbl dial__lbl--away-text',
                    style: 'pointer-events: none;'
                }, svg);
                const lblAwayText_text = document.createTextNode('AWAY');
                lblAwayText.appendChild(lblAwayText_text);
                
                // Leaf icon
                const leafScale = properties.radius / 5 / 100;
                const leafDef = ["M", 3, 84, "c", 24, 17, 51, 18, 73, -6, "C", 100, 52, 100, 22, 100, 4, "c", -13, 15, -37, 9, -70, 19, "C", 4, 32, 0, 63, 0, 76, "c", 6, -7, 18, -17, 33, -23, 24, -9, 34, -9, 48, -20, -9, 10, -20, 16, -43, 24, "C", 22, 63, 8, 78, 3, 84, "z"].map(x => {
                    return isNaN(x) ? x : x * leafScale;
                }).join(' ');
                const translate = [properties.radius - (leafScale * 100 * 0.5), properties.radius * 1.5];
                createSVGElement('path', {
                    class: 'dial__ico__leaf',
                    d: leafDef,
                    transform: 'translate(' + translate[0] + ',' + translate[1] + ')',
                    style: 'pointer-events: none;'
                }, svg);
                
                // Icône valise (suitcase) - centrée en bas
                const suitcaseGroup = createSVGElement('g', {
                    class: 'dial__suitcase',
                    transform: 'translate(' + (properties.radius - 25) + ',' + (properties.radius + properties.radius * 0.7) + ') scale(0.08)',
                    style: 'cursor: pointer;'
                }, svg);
                
                createSVGElement('circle', {
                    cx: 320,
                    cy: 320,
                    r: 350,
                    fill: 'rgba(255,255,255,0.1)',
                    class: 'dial__suitcase__bg'
                }, suitcaseGroup);
                
                createSVGElement('path', {
                    d: 'M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 544L432 544L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM480 160L480 544L512 544C547.3 544 576 515.3 576 480L576 224C576 188.7 547.3 160 512 160L480 160zM160 544L160 160L128 160C92.7 160 64 188.7 64 224L64 480C64 515.3 92.7 544 128 544L160 544z',
                    fill: 'white',
                    class: 'dial__suitcase__icon'
                }, suitcaseGroup);
                
                suitcaseGroup.addEventListener('click', (e) => {
                    e.stopPropagation();
                    thermostat.away = !thermostat.away;
                    console.log('Away toggled:', thermostat.away);
                    if (typeof options.onAwayToggle == 'function') {
                        options.onAwayToggle(thermostat.away);
                    }
                });
                
                // Render functions
                function render() {
                    renderAway();
                    renderHvacState();
                    renderTicks();
                    renderCenterTemperature();
                    renderDialTemperature();
                    renderLeaf();
                    renderAwayOffset();
                    renderAwayTickGreen();
                }
                
                function renderTicks() {
                    let vMin, vMax;
                    const effectiveSetpoint = getEffectiveSetpoint();
                    
                    if (state.away) {
                        vMin = Math.min(thermostat.ambient_temperature, thermostat.target_temperature);
                        vMax = Math.max(thermostat.ambient_temperature, thermostat.target_temperature);
                    } else {
                        vMin = Math.min(thermostat.ambient_temperature, effectiveSetpoint);
                        vMax = Math.max(thermostat.ambient_temperature, effectiveSetpoint);
                    }
                    
                    const min = restrictToRange(Math.round((vMin - options.minValue) / properties.rangeValue * options.numTicks), 0, options.numTicks - 1);
                    const max = restrictToRange(Math.round((vMax - options.minValue) / properties.rangeValue * options.numTicks), 0, options.numTicks - 1);
                    
                    tickArray.forEach((tick, iTick) => {
                        const isLarge = iTick == min || iTick == max;
                        const isActive = iTick >= min && iTick <= max;
                        attr(tick, {
                            d: pointsToPath(rotatePoints(isLarge ? tickPointsLarge : tickPoints, iTick * theta - properties.offsetDegrees, [properties.radius, properties.radius])),
                            class: isActive ? 'active' : ''
                        });
                    });
                }
                
                function renderAwayTickGreen() {
                    if (state.away && state.awayOffset !== 0) {
                        const effectiveSetpoint = getEffectiveSetpoint();
                        const peggedValue = restrictToRange(effectiveSetpoint, options.minValue, options.maxValue);
                        const degs = properties.tickDegrees * (peggedValue - options.minValue) / properties.rangeValue - properties.offsetDegrees;
                        
                        attr(tickAwayGreen, {
                            d: pointsToPath(rotatePoints(tickPointsAway, degs, [properties.radius, properties.radius])),
                            style: 'opacity: 1;'
                        });
                    } else {
                        attr(tickAwayGreen, {
                            style: 'opacity: 0;'
                        });
                    }
                }
                
                function renderDialTemperature() {
                    const valueToRender = (options.targetOnCenter ? thermostat.ambient_temperature : thermostat.target_temperature);
                    const valueRenderedInCenter = (options.targetOnCenter ? thermostat.target_temperature : thermostat.ambient_temperature);
                    lblDial_text.nodeValue = Math.floor(valueToRender);
                    if (valueToRender % 1 != 0) {
                        lblDial_text.nodeValue += '⁵';
                    }
                    const peggedValue = restrictToRange(valueToRender, options.minValue, options.maxValue);
                    let degs = properties.tickDegrees * (peggedValue - options.minValue) / properties.rangeValue - properties.offsetDegrees;
                    if (peggedValue > valueRenderedInCenter) {
                        degs += 8;
                    } else {
                        degs -= 8;
                    }
                    const pos = rotatePoint(properties.lblDialPosition, degs, [properties.radius, properties.radius]);
                    attr(lblDial, {
                        x: pos[0],
                        y: pos[1]
                    });
                    
                    const offsetX = 15;
                    const offsetY = -5;
                    attr(lblDialUnitsTop, {
                        x: pos[0] + offsetX,
                        y: pos[1] + offsetY
                    });
                }
                
                function renderCenterTemperature() {
                    const valueToRender = (options.targetOnCenter ? thermostat.target_temperature : thermostat.ambient_temperature);
                    lblCenter_text.nodeValue = Math.floor(valueToRender);
                    setClass(lblCenterHalf, 'shown', true);
                    lblCenterHalf_text.nodeValue = (valueToRender * 10) % 10;
                }
                
                function renderAwayOffset() {
                    if (state.away && state.awayOffset !== 0) {
                        const offsetStr = state.awayOffset >= 0 ? '+' + state.awayOffset : state.awayOffset;
                        lblAwayOffset_text.nodeValue = offsetStr + '°';
                        setClass(lblAwayOffset, 'shown', true);
                    } else {
                        lblAwayOffset_text.nodeValue = '';
                        setClass(lblAwayOffset, 'shown', false);
                    }
                }
                
                function renderLeaf() {
                    setClass(svg, 'has-leaf', thermostat.has_leaf);
                }
                
                function renderHvacState() {
                    Array.prototype.slice.call(svg.classList).forEach(c => {
                        if (c.match(/^dial--state--/)) {
                            svg.classList.remove(c);
                        }
                    });
                    svg.classList.add('dial--state--' + getVisualHvacState());
                }
                
                function renderAway() {
                    svg.classList[thermostat.away ? 'add' : 'remove']('away');
                    suitcaseGroup.classList[thermostat.away ? 'add' : 'remove']('active');
                    setClass(lblAwayText, 'shown', thermostat.away);
                }
                
                // Drag controls
                const _drag = {
                    inProgress: false,
                    startPoint: null,
                    startTemperature: 0,
                    lockAxis: undefined
                };
                
                function eventPosition(ev) {
                    if (ev.targetTouches && ev.targetTouches.length) {
                        return [ev.targetTouches[0].clientX, ev.targetTouches[0].clientY];
                    } else {
                        return [ev.clientX || ev.x, ev.clientY || ev.y];
                    }
                }
                
                let startDelay;
                
                function dragStart(ev) {
                    if (ev.target.closest('.dial__suitcase')) {
                        return;
                    }
                    
                    console.log('Drag start', ev.type);
                    startDelay = setTimeout(() => {
                        setClass(svg, 'dial--edit', true);
                        _drag.inProgress = true;
                        _drag.startPoint = eventPosition(ev);
                        _drag.startTemperature = thermostat.target_temperature || options.minValue;
                        _drag.lockAxis = undefined;
                        console.log('Drag activated');
                    }, 500);
                }
                
                function dragEnd(ev) {
                    console.log('Drag end', ev.type);
                    clearTimeout(startDelay);
                    setClass(svg, 'dial--edit', false);
                    if (!_drag.inProgress) return;
                    _drag.inProgress = false;
                    if (thermostat.target_temperature != _drag.startTemperature) {
                        console.log('Temperature changed to:', thermostat.target_temperature);
                        if (typeof options.onSetTargetTemperature == 'function') {
                            options.onSetTargetTemperature(thermostat.target_temperature);
                        }
                    }
                }
                
                function dragMove(ev) {
                    ev.preventDefault();
                    if (!_drag.inProgress) return;
                    const evPos = eventPosition(ev);
                    const dy = _drag.startPoint[1] - evPos[1];
                    const dx = evPos[0] - _drag.startPoint[0];
                    let dxy;
                    if (_drag.lockAxis == 'x') {
                        dxy = dx;
                    } else if (_drag.lockAxis == 'y') {
                        dxy = dy;
                    } else if (Math.abs(dy) > properties.dragLockAxisDistance) {
                        _drag.lockAxis = 'y';
                        dxy = dy;
                    } else if (Math.abs(dx) > properties.dragLockAxisDistance) {
                        _drag.lockAxis = 'x';
                        dxy = dx;
                    } else {
                        dxy = (Math.abs(dy) > Math.abs(dx)) ? dy : dx;
                    }
                    const dValue = (dxy * getSizeRatio()) / (options.diameter) * properties.rangeValue;
                    thermostat.target_temperature = roundHalf(_drag.startTemperature + dValue);
                }
                
                svg.addEventListener('mousedown', dragStart, false);
                svg.addEventListener('touchstart', dragStart, { passive: false });
                
                document.addEventListener('mouseup', dragEnd, false);
                document.addEventListener('touchend', dragEnd, false);
                
                svg.addEventListener('mousemove', dragMove, false);
                svg.addEventListener('touchmove', dragMove, { passive: false });
                
                svg.addEventListener('dragstart', (e) => e.preventDefault());
                
                function restrictTargetTemperature(t) {
                    return restrictToRange(roundHalf(t), options.minValue, options.maxValue);
                }
                
                function getSizeRatio() {
                    return options.diameter / targetElement.clientWidth;
                }
                
                calculateHVACState();
                render();
                
                console.log('Thermostat initialized');
            }
            
            // Créer l'instance du thermostat
            this.nest = new ThermostatDial(this.$refs.thermostatContainer, {
                targetOnCenter: true,
                diameter: 400,
                minValue: 10,
                maxValue: 30,
                numTicks: 200,
                hysteresis: this.hysteresis,
                mode: this.mode,
                awayOffset: this.awayOffset,
                onSetTargetTemperature: (v) => {
                    const payload = {
                        "ambient_temperature": this.nest.ambient_temperature,
                        "target_temperature": v,
                        "hvac_state": this.nest.hvac_state,
                        "mode": this.nest.mode,
                        "hysteresis": this.nest.hysteresis,
                        "awayOffset": this.nest.awayOffset,
                        "has_leaf": this.nest.has_leaf,
                        "away": this.nest.away
                    };
                    console.log('Sending:', payload);
                    this.send(payload);
                },
                onAwayToggle: (away) => {
                    const payload = {
                        "ambient_temperature": this.nest.ambient_temperature,
                        "target_temperature": this.nest.target_temperature,
                        "hvac_state": this.nest.hvac_state,
                        "mode": this.nest.mode,
                        "hysteresis": this.nest.hysteresis,
                        "awayOffset": this.nest.awayOffset,
                        "has_leaf": this.nest.has_leaf,
                        "away": away
                    };
                    console.log('Away toggled, sending:', payload);
                    this.send(payload);
                }
            });
            
            // Initialiser avec des valeurs par défaut
            this.nest.ambient_temperature = 20;
            this.nest.target_temperature = 21;
            this.nest.mode = this.mode;
            this.nest.hysteresis = this.hysteresis;
            this.nest.awayOffset = this.awayOffset;
            this.nest.has_leaf = false;
            this.nest.away = false;
        }
    },
    
    watch: {
        msg: {
            handler(msg) {
                if (msg && msg.payload && this.nest) {
                    console.log('Received msg:', msg);
                    
                    if (msg.payload.ambient_temperature !== undefined) {
                        this.nest.ambient_temperature = msg.payload.ambient_temperature;
                    }
                    if (msg.payload.target_temperature !== undefined) {
                        this.nest.target_temperature = msg.payload.target_temperature;
                    }
                    if (msg.payload.mode !== undefined) {
                        this.mode = msg.payload.mode;
                        this.nest.mode = msg.payload.mode;
                    }
                    if (msg.payload.hysteresis !== undefined) {
                        this.hysteresis = msg.payload.hysteresis;
                        this.nest.hysteresis = msg.payload.hysteresis;
                    }
                    if (msg.payload.awayOffset !== undefined) {
                        this.awayOffset = msg.payload.awayOffset;
                        this.nest.awayOffset = msg.payload.awayOffset;
                    }
                    if (msg.payload.has_leaf !== undefined) {
                        this.nest.has_leaf = msg.payload.has_leaf;
                    }
                    if (msg.payload.away !== undefined) {
                        this.nest.away = msg.payload.away;
                    }
                }
            },
            deep: true
        }
    }
}
</script>

<style scoped>
.thermostat-container {
    position: relative;
    width: 100%;
    height: 100%;
}

.thermostat-wrapper {
    width: 100%;
    height: 450px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.dial {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

.dial__suitcase {
    transition: opacity 0.3s ease;
}

.dial__suitcase__bg {
    transition: fill 0.3s ease;
}

.dial__suitcase:hover .dial__suitcase__bg {
    fill: rgba(255,255,255,0.2);
}

.dial__suitcase.active .dial__suitcase__icon {
    fill: #E36304;
}

.dial__tick--away-green {
    fill: #13EB13;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.dial.away .dial__ico__leaf {
    visibility: hidden;
}

.dial--edit .dial__lbl--diallabel {
    visibility: hidden;
}

.dial--edit .dial__lbl--centerlabel {
    visibility: visible;
}

.dial .dial__shape {
    -webkit-transition: fill 0.5s;
    transition: fill 0.5s;
}

.dial path.dial__ico__leaf {
    fill: #13EB13;
    opacity: 0;
    -webkit-transition: opacity 0.5s;
    transition: opacity 0.5s;
    pointer-events: none;
}

.dial.has-leaf .dial__ico__leaf {
    display: block;
    opacity: 1;
    pointer-events: none;
}

.dial__editableIndicator {
    fill-rule: evenodd;
    opacity: 0;
    -webkit-transition: opacity 0.5s;
    transition: opacity 0.5s;
}

.dial--edit path.dial__editableIndicator {
    fill: white;
}

.dial--edit .dial__editableIndicator {
    opacity: 1;
}

.dial--state--off .dial__shape {
    fill: #3d3c3c;
}

.dial--state--heating .dial__shape {
    fill: #E36304;
}

.dial--state--heating-away .dial__shape {
    fill: #C55304;
}

.dial--state--cooling .dial__shape {
    fill: #007AF1;
}

.dial--state--cooling-away .dial__shape {
    fill: #0066CC;
}

.dial .dial__ticks path {
    fill: rgba(255, 255, 255, 0.3);
}

.dial .dial__ticks path.active {
    fill: rgba(255, 255, 255, 0.8);
}

.dial text {
    fill: white;
    text-anchor: middle;
    font-family: Helvetica, sans-serif;
    alignment-baseline: central;
}

.dial__lbl--center {
    font-size: 120px;
    font-weight: bold;
}

.dial__lbl--centerlabel {
    font-size: 16px;
    font-weight: normal;
    visibility: hidden;
}

.dial__lbl--center--half {
    font-size: 40px;
    font-weight: bold;
    opacity: 0;
    -webkit-transition: opacity 0.1s;
    transition: opacity 0.1s;
}

.dial__lbl--center--half.shown {
    opacity: 1;
    -webkit-transition: opacity 0s;
    transition: opacity 0s;
}

.dial__lbl--away-offset {
    font-size: 32px;
    font-weight: bold;
    fill: #E36304;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.dial__lbl--away-offset.shown {
    opacity: 1;
}

.dial__lbl--dial {
    font-size: 22px;
    font-weight: bold;
}

.dial__lbl--dial--units-top {
    font-size: 14px;
    font-weight: normal;
}

.dial__lbl--away-text {
    font-size: 32px;
    font-weight: bold;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.dial__lbl--away-text.shown {
    opacity: 0.8;
}
</style>
