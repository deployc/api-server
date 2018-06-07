const fs = require('fs');
const { Socket } = require('net');
const { MemoryReadableStream } = require('../../utils/memory_stream');
const { validateAppName } = require('./acl');
const { getNamespace, getConfigMap } = require('./get');

const CERT_ISSUER = process.env.CERT_ISSUER !== undefined ? process.env.CERT_ISSUER : 'deployc-issuer-staging';

async function createOrUpdateDeployment(k8s, user, appName, image, config) {
    const namespace = await getNamespace(k8s, user, appName);
    if (namespace === null) {
        throw new Error(`App ${appName} does not exist.`);
    }

    // find the deployment
    const deploymentName = `${appName}-main`;
    let deployment = null;
    try {
        const { body } = await k8s.apis.apps.v1
            .namespaces(namespace.metadata.name)
            .deployments(deploymentName) // TODO: handle other "services"
            .get();
        deployment = body;
    } catch (error) {
        if (error.message.indexOf("not found") === -1) {
            throw error;
        }
    }

    let op = 'patch';
    if (!deployment) {
        console.log('Could not find deployment:', deploymentName);
        // create deployment
        deployment = {
            kind: 'Deployment',
            metadata: {
                name: deploymentName,
                namespace: namespace.metadata.name
            },
            spec: {
                selector: {
                    matchLabels: {
                        service: 'main'
                    }
                },
                replicas: 1,
                template: {
                    metadata: {
                        labels: {
                            service: 'main'
                        }
                    },
                    spec: {
                        automountServiceAccountToken: false,
                        containers: [{
                            name: 'main'
                        }],
                        // TODO: Add volumes
                    }
                }
            }
        }

        op = 'post';
    }

    const containerSpec = deployment.spec.template.spec.containers[0];
    containerSpec.image = image;
    if (config.command) {
        containerSpec.command = config.command;
    }

    const configMap = await getConfigMap(k8s, namespace);
    if (configMap !== null && configMap.data.vars !== undefined) {
        if (containerSpec.env === undefined) {
            containerSpec.env = [];
        }

        const vars = JSON.parse(configMap.data.vars);
        for (const [name, value] of Object.entries(vars)) {
            const envvar = { name };
            if (value.secret !== undefined) {
                envvar.valueFrom = {
                    secretKeyRef: { name: value.secret, key: 'value' }
                };
            } else {
                envvar.value = value;
            }

            containerSpec.env.push(envvar);
        }
    }

    if (op === 'post') {
        console.log('Creating deployment:', deploymentName);
        const result = await k8s.apis.apps.v1
            .namespaces(namespace.metadata.name)
            .deployments
            .post({ body: deployment });
        console.log('Deployment created:', deploymentName);
    } else {
        console.log('Updating deployment with image:', image);
        const result = await k8s.apis.apps.v1
            .namespaces(namespace.metadata.name)
            .deployments(deploymentName)
            .patch({ body: deployment });
        console.log('Deployment updated:', image);
    }

    return [deployment, namespace];
}

async function createOrUpdateService(k8s, namespace, port) {
    try {
        const { body: origService } = await k8s.api.v1
            .namespaces(namespace.metadata.name)
            .services('main')
            .get();

        await k8s.api.v1.namespaces(namespace.metadata.name)
            .services('main')
            .patch({
                body: {
                    spec: {
                        ports: [{ port, name: 'main' }]
                    }
                }
            });
        return;
    } catch (error) {
        if (error.message.indexOf('not found') === -1) {
            throw error;
        }
    }

    const body = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
            name: 'main',
            namespace: namespace.metadata.name,
            labels: {
                service: 'main'
            }
        },
        spec: {
            clusterIP: null,
            ports: [{
                port,
                name: 'main'
            }],
            selector: {
                service: 'main'
            }
        }
    };

    await k8s.api.v1.namespaces(namespace.metadata.name)
        .services
        .post({ body });
}

async function createOrUpdateIngress(k8s, namespace, port, domainName) {
    const rules = [{
        host: domainName,
        http: {
            paths: [{
                path: '/',
                backend: {
                    serviceName: 'main',
                    servicePort: port
                }
            }]
        }
    }];

    try {
        await k8s.apis.extensions.v1beta1
            .namespaces(namespace.metadata.name)
            .ingresses('main-ingress')
            .get();

        await k8s.apis.extensions.v1beta1
            .namespaces(namespace.metadata.name)
            .ingresses('main-ingress')
            .patch({
                body: {
                    spec: { rules }
                }
            });
        return;
    } catch (error) {
        if (error.message.indexOf('not found') === -1) {
            throw error;
        }
    }

    const body = {
        apiVersion: 'extensions/v1beta1',
        kind: 'Ingress',
        metadata: {
            name: 'main-ingress',
            namespace: namespace.metadata.name,
            annotations: {
                'nginx.ingress.kubernetes.io/rewrite-target': '/'
            }
        },
        spec: {
            rules,
            tls: [{
                hosts: [domainName],
                secretName: 'app-tls'
            }]
        }
    };

    await k8s.apis.extensions.v1beta1
        .namespaces(namespace.metadata.name)
        .ingresses
        .post({ body });
}

async function createCertificate(k8s, namespace, domainName) {
    try {
        await k8s.apis['certmanager.k8s.io']
            .v1alpha1
            .namespaces(namespace.metadata.name)
            .certificates('app-cert')
            .get();
        return false;
    } catch (error) {
        if (error.message.indexOf('not found') === -1) {
            throw error;
        }
    }

    const body = {
        apiVersion: 'certmanager.k8s.io/v1alpha1',
        kind: 'Certificate',
        metadata: {
            name: 'app-cert',
            namespace: namespace.metadata.name
        },
        spec: {
            secretName: 'app-tls',
            issuerRef: {
                kind: 'ClusterIssuer',
                name: CERT_ISSUER
            },
            dnsNames: [domainName],
            acme: {
                config: [{
                    dns01: {
                        provider: 'aws-dns',
                    },
                    domains: [domainName]
                }]
            }
        }
    };

    await k8s.apis['certmanager.k8s.io']
        .v1alpha1
        .namespaces(namespace.metadata.name)
        .certificates
        .post({ body });
    return true;
}

async function deployApp(ctx) {
    const { k8s } = ctx.state;
    const { appName } = ctx.params;
    const { username } = ctx.state.user;
    let { config } = ctx.request.body.fields;
    const { file } = ctx.request.body.files;
    validateAppName(appName);

    if (!config) {
        ctx.throw(400, '`config` is required.');
    }
    config = JSON.parse(config);

    if (!file) {
        ctx.throw(400, '`file` is required.');
    }

    const reader = fs.createReadStream(file.path);
    const stream = new MemoryReadableStream();
    const client = new Socket();
    let tag = null;
    let success = false;
    client.connect(9393, 'builder', () => {
        console.log('Connected');
        reader.pipe(client);
    });

    client.on('data', (data) => {
        const str = data.toString();
        const resultIdx = str.indexOf('[result]');
        if (resultIdx !== -1) {
            stream.push(str.slice(0, resultIdx));
            const result = str.slice(resultIdx).replace('[result]', '');
            if (!result.startsWith('FAILED')) {
                tag = result.trim();
                success = true
            } else {
                success = false;
            }
        } else {
            stream.push(str);
        }
    });

    client.on('close', async () => {
        console.log('Connection closed');
        if (tag === null || !success) {
            success = false;
            stream.push(null);
            return;
        }

        // make deployment
        stream.push('[stdout]Deploying app...\n');
        try {
            const [deployment, namespace] = await createOrUpdateDeployment(k8s, username, appName, tag, config);
            let exposed = false;
            const domainName = `${appName}.${username}.apps.deployc.io`;
            if (config.port !== undefined && typeof config.port === 'number') {
                await createCertificate(k8s, namespace, domainName);
                await createOrUpdateService(k8s, namespace, config.port, domainName);
                await createOrUpdateIngress(k8s, namespace, config.port, domainName);
                exposed = true;
            }

            stream.push(`[stdout]Successfully deployed ${appName}.\n`);
            if (exposed) {
                stream.push(`[stdout]Access at https://${domainName}\n`);
            }
            stream.push('[result]OK\n');
        } catch (error) {
            console.error('Failed to deploy:', error);
            stream.push(`[stderr]Could not deploy app: ${error}\n`);
            stream.push(`[result]FAILED\n`);
        }

        stream.push(null);
    });

    client.on('error', (err) => {
        console.error('Unexpected client error:', err);
        stream.push('[stderr]Internal server error.\n')
        stream.push('[result]FAILED\n');
    });

    ctx.body = stream;
}

module.exports = { deployApp };
