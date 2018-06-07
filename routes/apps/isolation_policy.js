const ISOLATION_POLICY = {
    metadata: {},
    spec: {
        podSelector: {}, // all pods in the namespace
        // ALLOW traffic from...
        ingress: [{
            from: [{
                // any pod in the namespace
                podSelector: {}
            }]
        }, {
            from: [{
                // OR any pod in the 'kube-system' namespace
                namespaceSelector: { matchLabels: { name: 'kube-system' } }
            }]
        }],
        // ALLOW traffic to...
        egress: [{
            to: [{
                // any pod in the namespace
                podSelector: {}
            }]
        }, {
            to: [{
                // OR allow all IPs except from the pod CIDR
                ipBlock: {
                    cidr: '0.0.0.0/0',
                    except: ['172.17.0.0/16']
                }
            }]
        }, {
            // ALLOW traffic to DNS
            to: [{
                namespaceSelector: { matchLabels: { name: 'kube-system' } }
            }],
            ports: [{
                protocol: 'UDP',
                port: 53
            }, {
                protocol: 'TCP',
                port: 53
            }]
        }]
    }
};

module.exports = { ISOLATION_POLICY };
