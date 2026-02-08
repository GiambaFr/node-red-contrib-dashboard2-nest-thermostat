module.exports = function(RED) {
    function ThermostatDialNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        // Récupérer la configuration du groupe UI
        var group = RED.nodes.getNode(config.group);
        
        if (!group) {
            node.error("No group configured");
            return;
        }
        
        // Configuration du nœud
        var nodeConfig = {
            name: config.name || "Thermostat Dial",
            order: config.order || 0,
            width: config.width || 6,
            height: config.height || 6,
            minTemp: parseFloat(config.minTemp) || 10,
            maxTemp: parseFloat(config.maxTemp) || 30,
            hysteresis: parseFloat(config.hysteresis) || 0.1,
            mode: config.mode || "heat",
            awayOffset: parseFloat(config.awayOffset) || -3
        };
        
        // État actuel du thermostat
        var state = {
            ambient_temperature: 20,
            target_temperature: 21,
            hvac_state: false,
            mode: nodeConfig.mode,
            hysteresis: nodeConfig.hysteresis,
            awayOffset: nodeConfig.awayOffset,
            has_leaf: false,
            away: false,
            lastHvacState: false
        };
        
        // Fonction pour calculer l'état HVAC avec hystérésis
        function calculateHVACState() {
            var setpoint = state.away ? state.target_temperature + state.awayOffset : state.target_temperature;
            var current = state.ambient_temperature;
            
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
        
        // Envoyer l'état au dashboard
        function sendToDashboard() {
            if (group) {
                group.emit('thermostat-dial-update', {
                    id: node.id,
                    value: state
                });
            }
        }
        
        // Envoyer l'état en sortie du nœud
        function sendOutput() {
            node.send({
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
            });
        }
        
        // Gérer les messages entrants
        node.on('input', function(msg) {
            var updated = false;
            
            if (msg.payload && typeof msg.payload === 'object') {
                // Mettre à jour l'état avec les valeurs reçues
                if (msg.payload.ambient_temperature !== undefined) {
                    state.ambient_temperature = parseFloat(msg.payload.ambient_temperature);
                    updated = true;
                }
                if (msg.payload.target_temperature !== undefined) {
                    state.target_temperature = parseFloat(msg.payload.target_temperature);
                    updated = true;
                }
                if (msg.payload.mode !== undefined && ['heat', 'cool'].indexOf(msg.payload.mode) >= 0) {
                    state.mode = msg.payload.mode;
                    updated = true;
                }
                if (msg.payload.hysteresis !== undefined) {
                    state.hysteresis = parseFloat(msg.payload.hysteresis);
                    updated = true;
                }
                if (msg.payload.awayOffset !== undefined) {
                    state.awayOffset = parseFloat(msg.payload.awayOffset);
                    updated = true;
                }
                if (msg.payload.has_leaf !== undefined) {
                    state.has_leaf = !!msg.payload.has_leaf;
                    updated = true;
                }
                if (msg.payload.away !== undefined) {
                    state.away = !!msg.payload.away;
                    updated = true;
                }
                
                if (updated) {
                    calculateHVACState();
                    sendToDashboard();
                    sendOutput();
                }
            }
        });
        
        // Gérer les messages du dashboard (changements utilisateur)
        group.on('thermostat-dial-input', function(msg) {
            if (msg.id === node.id) {
                var updated = false;
                
                if (msg.value.target_temperature !== undefined) {
                    state.target_temperature = parseFloat(msg.value.target_temperature);
                    updated = true;
                }
                if (msg.value.away !== undefined) {
                    state.away = !!msg.value.away;
                    updated = true;
                }
                
                if (updated) {
                    calculateHVACState();
                    sendToDashboard();
                    sendOutput();
                }
            }
        });
        
        // Envoyer l'état initial
        calculateHVACState();
        sendToDashboard();
        
        // Nettoyage à la fermeture
        node.on('close', function() {
            // Nettoyer les listeners
        });
    }
    
    RED.nodes.registerType("thermostat-dial", ThermostatDialNode);
};
