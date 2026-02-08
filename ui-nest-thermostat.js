const statestore = require('../store/state.js')

module.exports = function (RED) {
    function NestThermostatNode (config) {
        const node = this

        // create node in Node-RED
        RED.nodes.createNode(this, config)

        // which group are we rendering this widget
        const group = RED.nodes.getNode(config.group)

        if (!group) {
            node.error('No group configured')
            return
        }

        // État initial du thermostat
        const state = {
            ambient_temperature: parseFloat(config.ambientTemp) || 20,
            target_temperature: parseFloat(config.targetTemp) || 21,
            hvac_state: false,
            mode: config.mode || 'heat',
            hysteresis: parseFloat(config.hysteresis) || 0.5,
            awayOffset: parseFloat(config.awayOffset) || -3,
            minTemp: parseFloat(config.minTemp) || 10,
            maxTemp: parseFloat(config.maxTemp) || 30,
            has_leaf: false,
            away: false,
            lastHvacState: false
        }

        // Fonction pour calculer l'état HVAC avec hystérésis
        function calculateHVACState () {
            const setpoint = state.away ? state.target_temperature + state.awayOffset : state.target_temperature
            const current = state.ambient_temperature

            if (state.mode === 'heat') {
                if (setpoint > current + state.hysteresis) {
                    state.hvac_state = true
                    state.lastHvacState = true
                } else if (setpoint < current - state.hysteresis) {
                    state.hvac_state = false
                    state.lastHvacState = false
                } else {
                    state.hvac_state = state.lastHvacState
                }
            } else if (state.mode === 'cool') {
                if (setpoint < current - state.hysteresis) {
                    state.hvac_state = true
                    state.lastHvacState = true
                } else if (setpoint > current + state.hysteresis) {
                    state.hvac_state = false
                    state.lastHvacState = false
                } else {
                    state.hvac_state = state.lastHvacState
                }
            }
        }

        const evts = {
            onInput: function (msg, send) {
                // Gérer les messages entrants
                let updated = false

                if (msg.payload && typeof msg.payload === 'object') {
                    // Mettre à jour l'état avec les valeurs reçues
                    if (msg.payload.ambient_temperature !== undefined) {
                        state.ambient_temperature = parseFloat(msg.payload.ambient_temperature)
                        statestore.set(group, node, msg, 'ambient_temperature', state.ambient_temperature)
                        updated = true
                    }
                    if (msg.payload.target_temperature !== undefined) {
                        state.target_temperature = parseFloat(msg.payload.target_temperature)
                        statestore.set(group, node, msg, 'target_temperature', state.target_temperature)
                        updated = true
                    }
                    if (msg.payload.mode !== undefined && ['heat', 'cool'].indexOf(msg.payload.mode) >= 0) {
                        state.mode = msg.payload.mode
                        statestore.set(group, node, msg, 'mode', state.mode)
                        updated = true
                    }
                    if (msg.payload.hysteresis !== undefined) {
                        state.hysteresis = parseFloat(msg.payload.hysteresis)
                        statestore.set(group, node, msg, 'hysteresis', state.hysteresis)
                        updated = true
                    }
                    if (msg.payload.awayOffset !== undefined) {
                        state.awayOffset = parseFloat(msg.payload.awayOffset)
                        statestore.set(group, node, msg, 'awayOffset', state.awayOffset)
                        updated = true
                    }
                    if (msg.payload.has_leaf !== undefined) {
                        state.has_leaf = !!msg.payload.has_leaf
                        statestore.set(group, node, msg, 'has_leaf', state.has_leaf)
                        updated = true
                    }
                    if (msg.payload.away !== undefined) {
                        state.away = !!msg.payload.away
                        statestore.set(group, node, msg, 'away', state.away)
                        updated = true
                    }

                    if (updated) {
                        calculateHVACState()
                        statestore.set(group, node, msg, 'hvac_state', state.hvac_state)
                    }
                }

                return msg
            },
            onAction: function (msg, send) {
                // Gérer les actions de l'utilisateur depuis l'interface
                if (msg.payload && typeof msg.payload === 'object') {
                    let updated = false

                    if (msg.payload.target_temperature !== undefined) {
                        state.target_temperature = parseFloat(msg.payload.target_temperature)
                        updated = true
                    }
                    if (msg.payload.away !== undefined) {
                        state.away = !!msg.payload.away
                        updated = true
                    }

                    if (updated) {
                        calculateHVACState()

                        // Envoyer l'état complet en sortie
                        const outputMsg = {
                            payload: {
                                ambient_temperature: state.ambient_temperature,
                                target_temperature: state.target_temperature,
                                hvac_state: state.hvac_state,
                                mode: state.mode,
                                hysteresis: state.hysteresis,
                                awayOffset: state.awayOffset,
                                has_leaf: state.has_leaf,
                                away: state.away
                            }
                        }
                        send(outputMsg)
                    }
                }
            },
            beforeSend: function (msg) {
                // Ajouter l'état actuel avant d'envoyer
                msg.payload = {
                    ambient_temperature: state.ambient_temperature,
                    target_temperature: state.target_temperature,
                    hvac_state: state.hvac_state,
                    mode: state.mode,
                    hysteresis: state.hysteresis,
                    awayOffset: state.awayOffset,
                    has_leaf: state.has_leaf,
                    away: state.away
                }
                return msg
            }
        }

        // inform the dashboard UI that we are adding this node
        group.register(node, config, evts)

        // Calculer l'état initial
        calculateHVACState()
    }

    RED.nodes.registerType('ui-nest-thermostat', NestThermostatNode)
}