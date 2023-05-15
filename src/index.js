"use strict";
// https://api.akeneo.com/api-reference-60.html
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _http = require("http");
const _https = require("https");
const bunyan = require("bunyan");
const change = require("change-case");
const FormData = require("form-data");
const fs = require("fs");
const minimist = require("minimist");
const path = require("path");
const util = require("util");
const moduleName = 'akeneo';
let logger = bunyan.createLogger({ name: moduleName });
function setLogger(loggerIn) {
    logger = loggerIn;
}
exports.setLogger = setLogger;
const possibleTasks = [
    'exportAssetCategories',
    'exportAssetFamilies',
    'exportAssets',
    'exportAssetTags',
    'exportAssociationTypes',
    'exportAttributeGroups',
    'exportAttributes',
    'exportCategories',
    'exportChannels',
    'exportCurrencies',
    'exportFamilies',
    'exportFamilyVariants',
    'exportGroups',
    'exportLocales',
    'exportMeasureFamilies',
    'exportMeasurementFamilies',
    'exportProductMediaFiles',
    'exportProductModels',
    'exportProducts',
    'exportReferenceEntities',
    'fixSystemOfOrigin',
    'importAssetFamilies',
    'importAssetFamilyAssets',
    'importAssetFamilyAttributeOptions',
    'importAssetFamilyAttributes',
    'importAssociationTypes',
    'importAttributeGroups',
    'importAttributeOptions',
    'importAttributes',
    'importCategories',
    'importChannels',
    'importFamilies',
    'importFamilyVariants',
    'importMeasureFamilies',
    'importMeasurementFamilies',
    'importProductModels',
    'importProducts',
    'importReferenceEntities',
    'importReferenceEntityAttributeOptions',
    'importReferenceEntityAttributes',
    'importReferenceEntityRecords'
];
function argz(args = null) {
    const methodName = 'argz';
    const localArgs = minimist(args && args.length > 0 ? args : process.argv.slice(2), {
        alias: {
            h: 'help',
            p: 'parameter',
            t: 'tasks',
            v: 'version'
        },
        default: {
            t: 'exportProducts'
        },
        string: [
            'parameter'
        ]
    });
    const pkg = JSON.parse(fs.readFileSync('package.json').toString());
    const name = pkg.name ? pkg.name : '';
    const version = pkg.version ? pkg.version : '';
    if (localArgs.version) {
        console.log(`${version}`);
        process.exit(0);
    }
    if (localArgs.help) {
        console.log(`Usage: node src/index [options]\n`);
        console.log(`Options:`);
        console.log(`  -h, --help     print ${name} command line options`);
        console.log(`  -t, --tasks    specify task(s) to run: ${possibleTasks.join(', ')}.`);
        console.log(`  -v, --version  print ${name} version`);
        process.exit(0);
    }
    const parameter = localArgs.parameter ? localArgs.parameter : '';
    const result = { tasks: {}, parameter };
    const tasks = localArgs.tasks.split(',');
    for (const task of tasks) {
        let found = false;
        for (const possibleTask of possibleTasks) {
            if (possibleTask === task) {
                found = true;
                break;
            }
        }
        if (found) {
            result.tasks[task] = true;
        }
        else {
            console.error(`Task: ${task}, is not in the list of supported tasks: ${possibleTasks.join(', ')}.`);
            setTimeout(() => { process.exit(1); }, 10000);
        }
    }
    return result;
}
function inspect(obj, depth = 5) {
    return `${util.inspect(obj, true, depth, false)}`;
}
exports.inspect = inspect;
function load(filename, map, key) {
    const methodName = 'load';
    logger.debug({ moduleName, methodName, filename, map, key }, `Starting`);
    return new Promise((resolve, reject) => {
        let stream = null;
        if (filename) {
            let stat = null;
            try {
                stat = fs.statSync(filename);
            }
            catch (err) {
                if (err.code !== 'ENOENT') {
                    const error = err.message ? err.message : err;
                    logger.error({ moduleName, methodName, error }, `Error!`);
                }
                return resolve(map);
            }
            if (stat &&
                stat.size > 0) {
                stream = fs.createReadStream(filename);
            }
            else {
                return resolve(map);
            }
        }
        const timer = setTimeout(() => {
            const error = 'timed out.';
            logger.error({ moduleName, methodName, error }, `Error!`);
            reject(error);
        }, 60000);
        let data = '';
        if (stream) {
            logger.debug({ moduleName, methodName, stream }, `reading stream`);
            stream.setEncoding('utf8');
            stream.on('close', () => {
                clearTimeout(timer);
                logger.debug({ moduleName, methodName, filename, map, key }, `Stream closed.`);
                resolve(map);
            });
            stream.on('data', (chunk) => {
                clearTimeout(timer);
                data += chunk;
                let linefeed = 0;
                while ((linefeed = data.indexOf('\n')) > -1) {
                    const json = data.slice(0, linefeed).trim();
                    try {
                        const doc = JSON.parse(json);
                        let keyValue = '';
                        if (key instanceof Array) {
                            for (const element of key) {
                                keyValue += doc[element];
                            }
                        }
                        else {
                            // it's a string
                            keyValue += doc[key];
                        }
                        map.set(keyValue, doc);
                    }
                    catch (err) {
                        logger.error({ moduleName, methodName, filename, map, key, json, err }, `Error: failed to parse a line of the file.`);
                    }
                    data = data.slice(linefeed + 1, data.length);
                }
            });
            stream.on('end', () => {
                clearTimeout(timer);
                if (data) {
                    const json = data.trim();
                    if (json) {
                        const doc = JSON.parse(json);
                        let keyValue = '';
                        if (key instanceof Array) {
                            for (const element of key) {
                                keyValue += doc[element];
                            }
                        }
                        else {
                            // it's a string
                            keyValue += doc[key];
                        }
                        map.set(keyValue, doc);
                    }
                }
                logger.info({ moduleName, methodName, filename, map, key, size: map.size }, `${map.size} records loaded.`);
            });
            stream.on('error', (err) => {
                clearTimeout(timer);
                const error = err.message ? err.message : err;
                logger.error({ moduleName, methodName, error }, `stream.on error: ${err.message}`);
                reject(error);
            });
        }
    });
}
exports.load = load;
exports.baseUrl = process.env.AKENEO_BASE_URL || 'http://akeneo-pim.local';
exports.exportPath = process.env.AKENEO_EXPORT_PATH || '.';
exports.getLimit = Number.parseInt(process.env.AKENEO_GET_LIMIT || '', 10);
exports.patchLimit = Number.parseInt(process.env.AKENEO_PATCH_LIMIT || '100', 10);
exports.promiseLimit = Number.parseInt(process.env.AKENEO_PROMISE_LIMIT || '16', 10);
let clientId = process.env.AKENEO_CLIENT_ID || '';
let password = process.env.AKENEO_PASSWORD || '';
let secret = process.env.AKENEO_SECRET || '';
let tokenUrl = process.env.AKENEO_TOKEN_URL || '/api/oauth/v1/token';
let username = process.env.AKENEO_USERNAME || '';
let protocol = exports.baseUrl.slice(0, 5) === 'https' ? _https : _http;
let agent = new protocol.Agent({
    keepAlive: true,
    keepAliveMsecs: 300000,
    maxSockets: Infinity
});
function baseProtocol() {
    return exports.baseUrl.slice(0, exports.baseUrl.indexOf(':'));
}
exports.baseProtocol = baseProtocol;
function setBaseUrl(value) {
    exports.baseUrl = value;
    protocol = exports.baseUrl.slice(0, 5) === 'https' ? _https : _http;
    agent = new protocol.Agent({
        keepAlive: true,
        keepAliveMsecs: 300000,
        maxSockets: Infinity
    });
}
exports.setBaseUrl = setBaseUrl;
function setClientId(value) {
    clientId = value;
}
exports.setClientId = setClientId;
function setExportPath(value) {
    exports.exportPath = value;
}
exports.setExportPath = setExportPath;
function setPassword(value) {
    password = value;
}
exports.setPassword = setPassword;
function setSecret(value) {
    secret = value;
}
exports.setSecret = setSecret;
function setUsername(value) {
    username = value;
}
exports.setUsername = setUsername;
const OK = { status: 'OK' };
exports.AKENEO_CATEGORIES = 'categories';
exports.AKENEO_REFERENCE_ENTITY = 'akeneo_reference_entity';
exports.AKENEO_REFERENCE_ENTITY_COLLECTION = 'akeneo_reference_entity_collection';
exports.PIM_CATALOG_ASSET_COLLECTION = 'pim_catalog_asset_collection';
exports.PIM_CATALOG_BOOLEAN = 'pim_catalog_boolean';
exports.PIM_CATALOG_DATE = 'pim_catalog_date';
exports.PIM_CATALOG_FILE = 'pim_catalog_file';
exports.PIM_CATALOG_IDENTIFIER = 'pim_catalog_identifier';
exports.PIM_CATALOG_IMAGE = 'pim_catalog_image';
exports.PIM_CATALOG_METRIC = 'pim_catalog_metric';
exports.PIM_CATALOG_MULTISELECT = 'pim_catalog_multiselect';
exports.PIM_CATALOG_NUMBER = 'pim_catalog_number';
exports.PIM_CATALOG_PRICE_COLLECTION = 'pim_catalog_price_collection';
exports.PIM_CATALOG_SIMPLESELECT = 'pim_catalog_simpleselect';
exports.PIM_CATALOG_TABLE = 'pim_catalog_table';
exports.PIM_CATALOG_TEXT = 'pim_catalog_text';
exports.PIM_CATALOG_TEXTAREA = 'pim_catalog_textarea';
exports.PIM_REFERENCE_DATA_MULTISELECT = 'pim_reference_data_multiselect';
exports.PIM_REFERENCE_DATA_SIMPLESELECT = 'pim_reference_data_simpleselect';
exports.ATTRIBUTE_TYPES = new Set([
    exports.AKENEO_REFERENCE_ENTITY,
    exports.AKENEO_REFERENCE_ENTITY_COLLECTION,
    exports.PIM_CATALOG_ASSET_COLLECTION,
    exports.PIM_CATALOG_BOOLEAN,
    exports.PIM_CATALOG_DATE,
    exports.PIM_CATALOG_FILE,
    //  PIM_CATALOG_IDENTIFIER, there can be only one identifier
    exports.PIM_CATALOG_IMAGE,
    exports.PIM_CATALOG_METRIC,
    exports.PIM_CATALOG_MULTISELECT,
    exports.PIM_CATALOG_NUMBER,
    exports.PIM_CATALOG_PRICE_COLLECTION,
    exports.PIM_CATALOG_SIMPLESELECT,
    exports.PIM_CATALOG_TABLE,
    exports.PIM_CATALOG_TEXT,
    exports.PIM_CATALOG_TEXTAREA,
    exports.PIM_REFERENCE_DATA_MULTISELECT,
    exports.PIM_REFERENCE_DATA_SIMPLESELECT
]);
exports.REFERENCE_ENTITY_IMAGE = 'image';
exports.REFERENCE_ENTITY_MULTIPLE_OPTIONS = 'multiple_options';
exports.REFERENCE_ENTITY_NUMBER = 'number';
exports.REFERENCE_ENTITY_MULTIPLE_LINKS = 'reference_entity_multiple_links';
exports.REFERENCE_ENTITY_SINGLE_LINK = 'reference_entity_single_link';
exports.REFERENCE_ENTITY_SINGLE_OPTION = 'single_option';
exports.REFERENCE_ENTITY_TEXT = 'text';
// Yes, I know, there isn't a textarea type, it's text + textarea boolean, but I need to differentiate
exports.REFERENCE_ENTITY_TEXTAREA = 'textarea';
exports.ASSET_FAMILY_MEDIA_FILE = 'media_file';
exports.ASSET_FAMILY_MEDIA_LINK = 'media_link';
exports.ASSET_FAMILY_MULTIPLE_OPTIONS = 'multiple_options';
exports.ASSET_FAMILY_NUMBER = 'number';
exports.ASSET_FAMILY_SINGLE_OPTION = 'single_option';
exports.ASSET_FAMILY_TEXT = 'text';
// Yes, I know, there isn't a textarea type, it's text + textarea boolean, but I need to differentiate
exports.ASSET_FAMILY_TEXTAREA = 'textarea';
exports.filenameAssociationTypes = 'associationTypes.vac';
exports.filenameAttributes = 'attributes.vac';
exports.filenameAttributeGroups = 'attributeGroups.vac';
exports.filenameAttributeOptions = 'attributeOptions.vac';
exports.filenameCategories = 'categories.vac';
exports.filenameChannels = 'channels.vac';
exports.filenameCurrencies = 'currencies.vac';
exports.filenameFamilies = 'families.vac';
exports.filenameFamilyVariants = 'familyVariants.vac';
exports.filenameGroups = 'groups.vac';
exports.filenameLocales = 'locales.vac';
exports.filenameMeasureFamilies = 'measureFamilies.vac';
exports.filenameMeasurementFamilies = 'measurementFamilies.vac';
exports.filenameProducts = 'products.vac';
exports.filenameProductModels = 'productModels.vac';
exports.filenameProductMediaFiles = 'productMediaFiles.vac';
exports.filenameReferenceEntities = 'referenceEntities.vac';
exports.filenameReferenceEntityAttributes = 'referenceEntityAttributes.vac';
exports.filenameReferenceEntityAttributeOptions = 'referenceEntityAttributeOptions.vac';
exports.filenameReferenceEntityRecords = 'referenceEntityRecords.vac';
exports.filenameAssetFamilies = 'assetFamilies.vac';
exports.filenameAssetFamilyAttributes = 'assetFamilyAttributes.vac';
exports.filenameAssetFamilyAttributeOptions = 'assetFamilyAttributeOptions.vac';
exports.filenameAssetFamilyAssets = 'assetFamilyAssets.vac';
// v3 
exports.filenameAssets = 'assets.vac';
exports.filenameAssetCategories = 'assetCategories.vac';
exports.filenameAssetReferenceFiles = 'assetReferenceFiles.vac';
exports.filenameAssetTags = 'assetTags.vac';
exports.filenameAssetVariationFiles = 'assetVariationFiles.vac';
// end of v3
// Helper functions
function close(fd) {
    const methodName = 'close';
    return new Promise((resolve, reject) => {
        fs.close(fd, (err) => {
            if (err) {
                logger.error({ moduleName, methodName, error: inspect(err) });
                return reject(err);
            }
            else {
                return resolve(true);
            }
        });
    });
}
exports.close = close;
function mkdir(path) {
    const methodName = 'mkdir';
    return new Promise((resolve, reject) => {
        fs.mkdir(path, { recursive: true }, (err) => {
            if (err) {
                logger.error({ moduleName, methodName, error: inspect(err) });
                return reject(err);
            }
            else {
                return resolve(true);
            }
        });
    });
}
exports.mkdir = mkdir;
function open(path, flags = 'r') {
    const methodName = 'open';
    return new Promise((resolve, reject) => {
        fs.open(path, flags, (err, fd) => {
            if (err) {
                logger.error({ moduleName, methodName, error: inspect(err) });
                return reject(err);
            }
            else {
                return resolve(fd);
            }
        });
    });
}
exports.open = open;
function read(fileDesc) {
    const methodName = 'read';
    return new Promise((resolve, reject) => {
        fs.readFile(fileDesc, (err, data) => {
            if (err) {
                logger.error({ moduleName, methodName, error: inspect(err) });
                return reject(err);
            }
            else {
                return resolve(data);
            }
        });
    });
}
exports.read = read;
function stat(path) {
    const methodName = 'stat';
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(null);
                }
                else {
                    logger.error({ moduleName, methodName, error: inspect(err) });
                    reject(err);
                }
            }
            else {
                resolve(stats);
            }
        });
    });
}
exports.stat = stat;
function symlink(target, path, type = 'dir') {
    const methodName = 'symlink';
    return new Promise((resolve, reject) => {
        fs.symlink(target, path, type, (err) => {
            if (err) {
                logger.error({ moduleName, methodName, error: inspect(err) });
                reject(err);
            }
            else {
                resolve(true);
            }
        });
    });
}
exports.symlink = symlink;
function unlink(path) {
    const methodName = 'unlink';
    return new Promise((resolve, reject) => {
        fs.unlink(path, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(null);
                }
                else {
                    logger.error({ moduleName, methodName, error: inspect(err) });
                    reject(err);
                }
            }
            else {
                return resolve(true);
            }
        });
    });
}
exports.unlink = unlink;
function write(fd, data) {
    const methodName = 'write';
    return new Promise((resolve, reject) => {
        fs.write(fd, data, (err, written, bufferOrString) => {
            if (err) {
                logger.error({ moduleName, methodName, error: inspect(err) });
                return reject(err);
            }
            else {
                return resolve(written);
            }
        });
    });
}
exports.write = write;
function assetCode(name) {
    const tokens = name.split('-');
    let code = '';
    if (name &&
        name.length === 36 &&
        tokens.length === 5 &&
        tokens[0].length === 8 &&
        tokens[1].length === 4 &&
        tokens[2].length === 4 &&
        tokens[3].length === 4 &&
        tokens[4].length === 12) {
        code = name.replace(/-/g, "_");
    }
    else {
        code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
    }
    if (code.length > 255) {
        code = code.replace(/_/g, '');
    }
    if (code.length > 255) {
        logger.debug({ moduleName, methodName: 'assetCode' }, `WARNING: asset code truncated to 255 characters: ${code.toString()}.`);
        code = code.slice(0, 255);
    }
    return code;
}
exports.assetCode = assetCode;
function attributeCode(name) {
    const tokens = name.split('-');
    let code = '';
    if (name &&
        name.length === 36 &&
        tokens.length === 5 &&
        tokens[0].length === 8 &&
        tokens[1].length === 4 &&
        tokens[2].length === 4 &&
        tokens[3].length === 4 &&
        tokens[4].length === 12) {
        code = name.replace(/-/g, "_");
    }
    else {
        code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
    }
    if (code.length > 100) {
        code = code.replace(/_/g, '');
    }
    if (code.length > 100) {
        logger.debug({ moduleName, methodName: 'attributeCode' }, `WARNING: attribute code truncated to 100 characters: ${code.toString()}.`);
        code = code.slice(0, 100);
    }
    return code;
}
exports.attributeCode = attributeCode;
function attributeLabel(property) {
    let label = (property[0] === '"' &&
        property[property.length - 1] === '"') ?
        property.slice(1, property.length - 1) :
        change.capitalCase(property);
    if (label.length > 255) {
        logger.debug({ moduleName, methodName: 'attributeLabel' }, `WARNING: label truncated to 255 characters: ${label}.`);
        label = label.slice(0, 255);
    }
    return label;
}
exports.attributeLabel = attributeLabel;
function fileCode(name) {
    const tokens = name.split('-');
    let code = '';
    if (name &&
        name.length === 36 &&
        tokens.length === 5 &&
        tokens[0].length === 8 &&
        tokens[1].length === 4 &&
        tokens[2].length === 4 &&
        tokens[3].length === 4 &&
        tokens[4].length === 12) {
        code = name.replace(/-/g, "_");
    }
    else {
        code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
    }
    if (code.length > 255) {
        code = code.replace(/_/g, '');
    }
    if (code.length > 255) {
        logger.debug({ moduleName, methodName: 'fileCode' }, `WARNING: file code truncated to 250 characters: ${code.toString()}.`);
        code = code.slice(0, 255);
    }
    return code;
}
exports.fileCode = fileCode;
function referenceEntityCode(name) {
    const tokens = name.split('-');
    let code = '';
    if (name &&
        name.length === 36 &&
        tokens.length === 5 &&
        tokens[0].length === 8 &&
        tokens[1].length === 4 &&
        tokens[2].length === 4 &&
        tokens[3].length === 4 &&
        tokens[4].length === 12) {
        code = name.replace(/-/g, "_");
    }
    else {
        code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
    }
    if (code.length > 255) {
        code = code.replace(/_/g, '');
    }
    if (code.length > 255) {
        logger.debug({ moduleName, methodName: 'referenceEntityCode' }, `WARNING: reference entity code truncated to 255 characters: ${code.toString()}.`);
        code = code.slice(0, 255);
    }
    return code;
}
exports.referenceEntityCode = referenceEntityCode;
function urlCode(name) {
    const tokens = name.split('-');
    let code = '';
    if (name &&
        name.length === 36 &&
        tokens.length === 5 &&
        tokens[0].length === 8 &&
        tokens[1].length === 4 &&
        tokens[2].length === 4 &&
        tokens[3].length === 4 &&
        tokens[4].length === 12) {
        code = name.replace(/-/g, "_");
    }
    else {
        code = `${encodeURIComponent(name).replace(/[^0-9a-zA-Z]/g, '_')}`;
    }
    if (code.length > 255) {
        code = code.replace(/_/g, '');
    }
    if (code.length > 255) {
        logger.debug({ moduleName, methodName: 'urlCode' }, `WARNING: url code truncated to 255 characters: ${code.toString()}.`);
        code = code.slice(0, 255);
    }
    return code;
}
exports.urlCode = urlCode;
function deQuote(property) {
    let localProperty = property;
    if (localProperty &&
        localProperty[0] === '"' &&
        localProperty[localProperty.length - 1] === '"') {
        localProperty = localProperty.slice(1, localProperty.length - 1);
    }
    return localProperty;
}
exports.deQuote = deQuote;
function mkdirs(dirParts) {
    const methodName = 'mkdirs';
    logger.debug({ moduleName, methodName }, `Starting...`);
    const dirs = exports.exportPath.split(path.sep);
    for (const dirPart of dirParts) {
        dirs.push(dirPart);
    }
    let dirPath = '';
    for (const dir of dirs) {
        if (dir !== '.') {
            dirPath += path.sep;
            dirPath += dir;
            try {
                fs.mkdirSync(dirPath);
            }
            catch (err) {
                if (err.code !== 'EEXIST') {
                    throw err;
                }
            }
        }
        else {
            dirPath += dir;
        }
    }
    return dirPath;
}
exports.mkdirs = mkdirs;
// Catalog API URLs
function apiUrlFamilies(code = '') {
    return code ? `/api/rest/v1/families/${code}` : '/api/rest/v1/families';
}
exports.apiUrlFamilies = apiUrlFamilies;
function apiUrlFamilyVariants(familyCode, code = '') {
    return code ? `${apiUrlFamilies()}/${familyCode}/variants/${code}` : `${apiUrlFamilies()}/${familyCode}/variants`;
}
exports.apiUrlFamilyVariants = apiUrlFamilyVariants;
function apiUrlGroups(code = '') {
    return code ? `/api/rest/v1/groups/${code}` : '/api/rest/v1/groups';
}
exports.apiUrlGroups = apiUrlGroups;
function apiUrlAttributes(code = '') {
    return code ? `/api/rest/v1/attributes/${code}` : '/api/rest/v1/attributes';
}
exports.apiUrlAttributes = apiUrlAttributes;
function apiUrlAttributeOptions(attributeCode, code = '') {
    return code ? `${apiUrlAttributes()}/${attributeCode}/options/${code}` : `${apiUrlAttributes()}/${attributeCode}/options`;
}
exports.apiUrlAttributeOptions = apiUrlAttributeOptions;
function apiUrlAttributeGroups(code = '') {
    return code ? `/api/rest/v1/attribute-groups/${code}` : '/api/rest/v1/attribute-groups';
}
exports.apiUrlAttributeGroups = apiUrlAttributeGroups;
function apiUrlAssociationTypes(code = '') {
    return code ? `/api/rest/v1/association-types/${code}` : '/api/rest/v1/association-types';
}
exports.apiUrlAssociationTypes = apiUrlAssociationTypes;
function apiUrlCategories(code = '') {
    return code ? `/api/rest/v1/categories/${code}` : '/api/rest/v1/categories';
}
exports.apiUrlCategories = apiUrlCategories;
// Product API URLs
function apiUrlProducts(identifier = '') {
    return identifier ? `/api/rest/v1/products/${identifier}` : '/api/rest/v1/products';
}
exports.apiUrlProducts = apiUrlProducts;
function apiUrlProductModels(code = '') {
    return code ? `/api/rest/v1/product-models/${code}` : '/api/rest/v1/product-models';
}
exports.apiUrlProductModels = apiUrlProductModels;
function apiUrlPublishedProducts(code = '') {
    return code ? `/api/rest/v1/published-products/${code}` : '/api/rest/v1/published-products';
}
exports.apiUrlPublishedProducts = apiUrlPublishedProducts;
function apiUrlProductMediaFiles(code = '') {
    return code ? `/api/rest/v1/media-files/${code}` : '/api/rest/v1/media-files';
}
exports.apiUrlProductMediaFiles = apiUrlProductMediaFiles;
// Target Market URLs
function apiUrlChannels(code = '') {
    return code ? `/api/rest/v1/channels/${code}` : '/api/rest/v1/channels';
}
exports.apiUrlChannels = apiUrlChannels;
function apiUrlLocales(code = '') {
    return code ? `/api/rest/v1/locales/${code}` : '/api/rest/v1/locales';
}
exports.apiUrlLocales = apiUrlLocales;
function apiUrlCurrencies(code = '') {
    return code ? `/api/rest/v1/currencies/${code}` : '/api/rest/v1/currencies';
}
exports.apiUrlCurrencies = apiUrlCurrencies;
function apiUrlMeasureFamilies(code = '') {
    return code ? `/api/rest/v1/measure-families/${code}` : '/api/rest/v1/measure-families';
}
exports.apiUrlMeasureFamilies = apiUrlMeasureFamilies;
function apiUrlMeasurementFamilies(code = '') {
    return code ? `/api/rest/v1/measurement-families/${code}` : '/api/rest/v1/measurement-families';
}
exports.apiUrlMeasurementFamilies = apiUrlMeasurementFamilies;
/******************** R E F E R E N C E   E N T I T I E S ********************/
function apiUrlReferenceEntities(referenceEntityCode = '') {
    return referenceEntityCode ?
        `/api/rest/v1/reference-entities/${referenceEntityCode}` :
        '/api/rest/v1/reference-entities';
}
exports.apiUrlReferenceEntities = apiUrlReferenceEntities;
function apiUrlReferenceEntityAttributes(referenceEntityCode, referenceEntityAttributeCode = '') {
    return referenceEntityAttributeCode ?
        `/api/rest/v1/reference-entities/${referenceEntityCode}/attributes/${referenceEntityAttributeCode}` :
        `/api/rest/v1/reference-entities/${referenceEntityCode}/attributes`;
}
exports.apiUrlReferenceEntityAttributes = apiUrlReferenceEntityAttributes;
function apiUrlReferenceEntityAttributeOptions(referenceEntityCode, referenceEntityAttributeCode, referenceEntityAttributeOptionCode = '') {
    return referenceEntityAttributeOptionCode ?
        `/api/rest/v1/reference-entities/${referenceEntityCode}` +
            `/attributes/${referenceEntityAttributeCode}` +
            `/options/${referenceEntityAttributeOptionCode}` :
        `/api/rest/v1/reference-entities/${referenceEntityCode}` +
            `/attributes/${referenceEntityAttributeCode}/options`;
}
exports.apiUrlReferenceEntityAttributeOptions = apiUrlReferenceEntityAttributeOptions;
function apiUrlReferenceEntityRecords(referenceEntityCode, referenceEntityRecordCode = '') {
    return referenceEntityRecordCode ?
        `/api/rest/v1/reference-entities/${referenceEntityCode}/records/${referenceEntityRecordCode}` :
        `/api/rest/v1/reference-entities/${referenceEntityCode}/records`;
}
exports.apiUrlReferenceEntityRecords = apiUrlReferenceEntityRecords;
function apiUrlReferenceEntityMediaFiles(referenceEntityMediaFileCode = '') {
    return referenceEntityMediaFileCode ?
        `/api/rest/v1/reference-entities-media-files/${referenceEntityMediaFileCode}` :
        '/api/rest/v1/reference-entities-media-files';
}
exports.apiUrlReferenceEntityMediaFiles = apiUrlReferenceEntityMediaFiles;
/******************** A S S E T   F A M I L I E S ********************/
function apiUrlAssetFamilies(assetFamilyCode = '') {
    return assetFamilyCode ?
        `/api/rest/v1/asset-families/${assetFamilyCode}` :
        '/api/rest/v1/asset-families';
}
exports.apiUrlAssetFamilies = apiUrlAssetFamilies;
function apiUrlAssetFamilyAttributes(assetFamilyCode, assetFamilyAttributeCode = '') {
    return assetFamilyAttributeCode ?
        `/api/rest/v1/asset-families/${assetFamilyCode}/attributes/${assetFamilyAttributeCode}` :
        `/api/rest/v1/asset-families/${assetFamilyCode}/attributes`;
}
exports.apiUrlAssetFamilyAttributes = apiUrlAssetFamilyAttributes;
function apiUrlAssetFamilyAttributeOptions(assetFamilyCode, assetFamilyAttributeCode, assetFamilyAttributeOptionCode = '') {
    return assetFamilyAttributeOptionCode ?
        `/api/rest/v1/asset-families/${assetFamilyCode}` +
            `/attributes/${assetFamilyAttributeCode}` +
            `/options/${assetFamilyAttributeOptionCode}` :
        `/api/rest/v1/asset-families/${assetFamilyCode}` +
            `/attributes/${assetFamilyAttributeCode}` +
            `/options`;
}
exports.apiUrlAssetFamilyAttributeOptions = apiUrlAssetFamilyAttributeOptions;
function apiUrlAssetFamilyMediaFiles(assetFamilyAssetCode = '') {
    return assetFamilyAssetCode ?
        `/api/rest/v1/asset-media-files/${assetFamilyAssetCode}` :
        `/api/rest/v1/asset-media-files`;
}
exports.apiUrlAssetFamilyMediaFiles = apiUrlAssetFamilyMediaFiles;
function apiUrlAssetFamilyAssets(assetFamilyCode, assetFamilyAssetCode = '') {
    return assetFamilyAssetCode ?
        `/api/rest/v1/asset-families/${assetFamilyCode}/assets/${assetFamilyAssetCode}` :
        `/api/rest/v1/asset-families/${assetFamilyCode}/assets`;
}
exports.apiUrlAssetFamilyAssets = apiUrlAssetFamilyAssets;
// v3 PAM
function apiUrlAssets() {
    return `/api/rest/v1/assets`;
}
exports.apiUrlAssets = apiUrlAssets;
function apiUrlAssetReferenceFiles(assetCode, localeCode) {
    return `/api/rest/v1/assets/${assetCode}/reference-files/${localeCode}`;
}
exports.apiUrlAssetReferenceFiles = apiUrlAssetReferenceFiles;
function apiUrlAssetVariationFiles(assetCode, channelCode, localeCode) {
    return `/api/rest/v1/assets/${assetCode}/variation-files/${channelCode}/${localeCode}`;
}
exports.apiUrlAssetVariationFiles = apiUrlAssetVariationFiles;
function apiUrlAssetCategories() {
    return '/api/rest/v1/asset-categories';
}
exports.apiUrlAssetCategories = apiUrlAssetCategories;
function apiUrlAssetTags() {
    return '/api/rest/v1/asset-tags';
}
exports.apiUrlAssetTags = apiUrlAssetTags;
// end of v3
/******************** H T T P / H T T P S ********************/
// delete is a reserved word
function delete_(apiUrl, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'delete_';
        logger.info({ moduleName, methodName, apiUrl }, `Starting...`);
        const dataString = JSON.stringify(data);
        const accessToken = yield getToken();
        return new Promise((resolve, reject) => {
            let buffer = Buffer.from('');
            const options = {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(dataString, 'utf8')
                },
                method: 'DELETE'
            };
            const url = `${exports.baseUrl}${apiUrl}`;
            const request = protocol.request(url, options, (response) => {
                const statusCode = response.statusCode;
                const headers = response.headers;
                if (statusCode &&
                    statusCode > 299) {
                    logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
                }
                response.on('data', (data) => {
                    logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString() });
                    buffer = buffer.length > 0 ? Buffer.concat([buffer, data]) : data;
                });
                response.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString() });
                    if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                        const fileDescriptor = yield open(path.join(exports.exportPath, 'deleteReponse.txt'), 'a');
                        yield write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield close(fileDescriptor);
                    }
                    let results = { statusCode: response.statusCode };
                    if (buffer.length > 0) {
                        try {
                            results = JSON.parse(buffer.toString());
                            results.statusCode = response.statusCode;
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString() });
                            const html = buffer.toString('utf8');
                            results = {
                                html,
                                headers,
                                statusCode
                            };
                            return resolve(results);
                        }
                    }
                    return resolve(results);
                }));
            });
            request.on('error', (err) => {
                logger.error({ moduleName, methodName, event: 'error', err });
                return reject(err);
            });
            request.write(dataString);
            request.end();
        });
    });
}
exports.delete_ = delete_;
function splitMediaFileData(data) {
    // the underscore is used to separate the guid from the actual filename
    /*
    const parts: any[] = data.split('_');
    const path: string = parts.length > 0 ? parts[0] : '';
    const name: string = parts.length > 1 ? parts.slice(1, parts.length).join('_');
    */
    const results = {};
    const firstUnderscoreAt = data.indexOf('_');
    if (firstUnderscoreAt !== -1) {
        results.path = data.slice(0, firstUnderscoreAt);
        results.name = data.slice(firstUnderscoreAt + 1, data.length);
    }
    else {
        results.path = '';
        results.name = data;
    }
    return results;
}
exports.splitMediaFileData = splitMediaFileData;
function download(data, url) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'download';
        logger.info({ moduleName, methodName, data, url }, `Starting...`);
        let results = [];
        if (!data ||
            !url) {
            return false;
        }
        logger.info({ moduleName, methodName }, `Making Dirs...`);
        const pathAndFile = splitMediaFileData(data);
        const pathParts = pathAndFile.path.split(path.sep);
        let pathString = exports.exportPath;
        for (let i = 0; i < pathParts.length; i++) {
            pathString += `${path.sep}${pathParts[i]}`;
            try {
                yield mkdir(pathString);
            }
            catch (err) {
                if (err.code !== 'EEXIST') {
                    logger.error({ moduleName, methodName, error: inspect(err) });
                }
            }
        }
        const accessToken = yield getToken();
        const result = yield new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/octet-stream',
                    'Connection': 'keep-alive'
                },
                method: 'GET'
            };
            const request = protocol.request(url, options, (response) => __awaiter(this, void 0, void 0, function* () {
                const stream = fs.createWriteStream(path.join(path.join(exports.exportPath, pathAndFile.path), pathAndFile.name));
                const statusCode = response.statusCode;
                const headers = response.headers;
                logger.debug({ moduleName, methodName, statusCode });
                if (statusCode &&
                    statusCode > 299) {
                    logger.warn({ moduleName, methodName, statusCode, headers, url }, `Error: ${response.statusMessage}`);
                }
                response.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    logger.info({ moduleName, methodName, event: 'end' });
                    return resolve(OK);
                }));
                response.pipe(stream);
            }));
            request.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                logger.error({ moduleName, methodName, event: 'error', err });
                return reject(err);
            }));
            request.end();
        });
        return result;
    });
}
exports.download = download;
const FIVE_MINUTES = 5 * 60 * 1000;
let getTokenCount = 0;
let tokenResponse;
let tokenExpiresAt = 0;
function getToken() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'getToken';
        logger.debug({ moduleName, methodName }, `Starting...`);
        return new Promise((resolve, reject) => {
            if (tokenResponse &&
                tokenExpiresAt > Date.now() + FIVE_MINUTES) {
                return resolve(tokenResponse.access_token);
            }
            let buffer = Buffer.from('');
            const base64ClientIdSecret = Buffer.from(`${clientId}:${secret}`).toString('base64');
            const basicAuthorization = `Basic ${base64ClientIdSecret}`;
            const data = `username=${encodeURI(username)}&password=${encodeURI(password)}&grant_type=password`;
            const options = {
                headers: {
                    'Authorization': basicAuthorization,
                    'Content-Type': `application/x-www-form-urlencoded`,
                    'Content-Length': data.length // turns off chunked encoding
                },
                method: 'POST'
            };
            const url = `${exports.baseUrl}${tokenUrl}`;
            const tokenRequestedAt = Date.now();
            const request = protocol.request(url, options, (response) => __awaiter(this, void 0, void 0, function* () {
                const statusCode = response.statusCode;
                const headers = response.headers;
                if (statusCode &&
                    statusCode > 299) {
                    logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
                }
                response.on('data', (data) => {
                    logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString() });
                    buffer = buffer.length > 0 ? Buffer.concat([buffer, data]) : data;
                });
                response.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString() });
                    if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                        const fileDescriptor = yield open(path.join(exports.exportPath, 'getTokenReponse.txt'), 'a');
                        yield write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield close(fileDescriptor);
                    }
                    let results = { statusCode: response.statusCode };
                    if (buffer.length > 0) {
                        try {
                            results = JSON.parse(buffer.toString());
                            results.statusCode = response.statusCode;
                            /*
                            {
                              access_token: 'ZGEwNWQ0MTRhMjBlMzM0NjEyZTEyMjg5MGZmZGNlMzZiNjVjMWQ0MDkyMDVkM2FiZmY2YmQzNzA0NTE4NGQ2YQ',
                              expires_in: 3600,
                              token_type: 'bearer',
                              scope: null,
                              refresh_token: 'MjFjNzY1Njc3NWZlOTkxN2Y3ZmFlNDVmYWU3NjRjODhiMTA4ZjgxM2Y3Yzg3ZGYzMmVkNmYwNWE5NzQ4NTdhNQ',
                              statusCode: 200
                            }
                            */
                            tokenResponse = results ? results : {};
                            tokenExpiresAt = tokenRequestedAt + (tokenResponse.expires_in * 1000);
                            logger.debug({ moduleName, methodName }, `tokenResponse=\n${inspect(tokenResponse)}`);
                            return resolve(tokenResponse.access_token);
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString() });
                            const html = buffer.toString('utf8');
                            results = {
                                html,
                                headers,
                                statusCode
                            };
                            return reject(results);
                        }
                    }
                    return reject(results);
                }));
            }));
            request.on('error', (err) => {
                logger.error({ moduleName, methodName, event: 'error', err });
                return reject(err);
            });
            request.write(data);
            request.end();
        });
    });
}
function get(apiUrl, callback = null) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'get';
        logger.info({ moduleName, methodName, apiUrl }, `Starting...`);
        let results = [];
        let url = apiUrl.indexOf('?') === -1 ? `${exports.baseUrl}${apiUrl}?limit=${exports.patchLimit}` : `${exports.baseUrl}${apiUrl}&limit=${exports.patchLimit}`;
        for (;;) {
            const accessToken = yield getToken();
            const timeout = 60 * 1000;
            const result = yield new Promise((resolve, reject) => {
                let buffer = Buffer.from('');
                const options = {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Connection': 'keep-alive'
                    },
                    method: 'GET',
                    timeout
                };
                const request = protocol.request(url, options, (response) => __awaiter(this, void 0, void 0, function* () {
                    const statusCode = response.statusCode;
                    const headers = response.headers;
                    logger.debug({ moduleName, methodName, statusCode });
                    if (statusCode &&
                        statusCode > 299) {
                        logger.warn({ moduleName, methodName, statusCode, headers, url }, `Error: ${response.statusMessage}`);
                    }
                    response.on('data', (data) => {
                        logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString() });
                        buffer = buffer.length > 0 ? Buffer.concat([buffer, data]) : data;
                    });
                    response.on('end', () => __awaiter(this, void 0, void 0, function* () {
                        logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString() });
                        if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                            const fileDescriptor = yield open(path.join(exports.exportPath, 'getReponse.txt'), 'a');
                            yield write(fileDescriptor, buffer.toString('utf8') + '\n');
                            yield close(fileDescriptor);
                        }
                        let results = { statusCode };
                        if (buffer.length > 0) {
                            try {
                                results = JSON.parse(buffer.toString());
                                if (!(results instanceof Array)) {
                                    results.headers = headers;
                                    results.statusCode = statusCode;
                                }
                            }
                            catch (err) {
                                logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString() });
                                const html = buffer.toString('utf8');
                                results = {
                                    html,
                                    headers,
                                    statusCode
                                };
                                return resolve(results);
                            }
                        }
                        return resolve(results);
                    }));
                }));
                request.on('error', (err) => {
                    logger.error({ moduleName, methodName, event: 'error', err });
                    return reject(err);
                });
                request.end();
            });
            /* a single product
                {
                  identifier: '11057379',
                  enabled: true,
                  family: 'pc_monitors',
                  categories: [ 'lenovo', 'pc_monitors', 'tvs_projectors_sales', [length]: 3 ],
                  groups: [ [length]: 0 ],
                  parent: null,
                  values: {
                    name: [
                      { locale: null, scope: null, data: 'Lenovo ThinkVision LT2452p' },
                      [length]: 1
                    ],
                    description: [
                      {
                        locale: 'en_US',
                        scope: 'print',
                        data: 'Designed for large enterprises, the LT2452p is the perfect companion for your ThinkCentre desktops. Using a display has never been more comfortable, with exceptional on screen performance, with In-plane Switching (IPS) for wide viewing angles. Engineered with collaboration in mind, the 24" widescreen has lift, tilt, swivel, and pivot capacity, allowing for high viewing comfort. The LT2452p also offers high energy savings with green certifications. Additionally, the four USB ports allow you to connect portable devices directly to your screen, adding expansion options to your PC. The LT2452p widescreen monitor is the right choice for those who need an ultimate display to increase productivity and ease of use.\\n\\n<b>Features and Benefit:</b>\\n\\n- Native resolution of 1920x1200 eIPS panel\\n- White LED backlight\\n- Aspect ratio: 16:10\\n- Brightness: 300 cd/m2 (typical)\\n- Contrast ratio: 1000:1 (typical)\\n- View angles(Horizontal/Vertical, @CR=10:1): 178 degrees / 178 degrees\\n- Respond time: 7ms (GtG)\\n- lift, Tilt, swivel and pivot stand\\n- VGA, DVI-D, DisplayPort connections\\n- Compliance with ENERGY STAR 5.1 requirements\\n- TCO certified Edge 1.1\\n- EPEAT Gold/ULE Gold\\n- Kensington Lock slot support for security\\n- Meets 100mm VESA standard(*) for mounting\\n- Cable Management for better user experience'
                      },
                      [length]: 1
                    ],
                    display_srgb: [ { locale: null, scope: null, data: false }, [length]: 1 ],
                    display_color: [ { locale: null, scope: null, data: false }, [length]: 1 ],
                    release_date: [
                      {
                        locale: null,
                        scope: 'ecommerce',
                        data: '2011-09-22T00:00:00+00:00'
                      },
                      [length]: 1
                    ],
                    response_time: [ { locale: null, scope: null, data: 7 }, [length]: 1 ],
                    display_diagonal: [
                      { locale: null, scope: null, data: { amount: 24, unit: 'INCH' } },
                      [length]: 1
                    ]
                  },
                  created: '2022-11-14T23:16:33+00:00',
                  updated: '2022-11-14T23:16:33+00:00',
                  associations: {
                    PACK: {
                      products: [ [length]: 0 ],
                      product_models: [ [length]: 0 ],
                      groups: [ [length]: 0 ]
                    },
                    UPSELL: {
                      products: [ [length]: 0 ],
                      product_models: [ [length]: 0 ],
                      groups: [ [length]: 0 ]
                    },
                    X_SELL: {
                      products: [ [length]: 0 ],
                      product_models: [ [length]: 0 ],
                      groups: [ [length]: 0 ]
                    },
                    SUBSTITUTION: {
                      products: [ [length]: 0 ],
                      product_models: [ [length]: 0 ],
                      groups: [ [length]: 0 ]
                    }
                  },
                  quantified_associations: {},
                  headers: {
                    date: 'Fri, 18 Nov 2022 23:47:06 GMT',
                    server: 'Apache/2.4.46 (Unix)',
                    'cache-control': 'no-cache, private',
                    'content-security-policy': "default-src 'self' *.akeneo.com 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'nonce-07f41c14e74157aff6fa6296dac0027c13e46705'; img-src 'self' data: *.akeneo.com; frame-src *; font-src 'self' data:; connect-src 'self' *.akeneo.com",
                    'x-content-security-policy': "default-src 'self' *.akeneo.com 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'nonce-07f41c14e74157aff6fa6296dac0027c13e46705'; img-src 'self' data: *.akeneo.com; frame-src *; font-src 'self' data:; connect-src 'self' *.akeneo.com",
                    'x-webkit-csp': "default-src 'self' *.akeneo.com 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'nonce-07f41c14e74157aff6fa6296dac0027c13e46705'; img-src 'self' data: *.akeneo.com; frame-src *; font-src 'self' data:; connect-src 'self' *.akeneo.com",
                    connection: 'close',
                    'transfer-encoding': 'chunked',
                    'content-type': 'application/json'
                  },
                  statusCode: 200
                }
            
            */
            /* multiple products
            {
              _links: {
                self: {
                  href: 'http://localhost:8080/api/rest/v1/products?with_count=false&pagination_type=search_after&limit=100'
                },
                first: {
                  href: 'http://localhost:8080/api/rest/v1/products?with_count=false&pagination_type=search_after&limit=100'
                },
                next: {
                  href: 'http://localhost:8080/api/rest/v1/products?with_count=false&pagination_type=search_after&limit=100&search_after=11057379'
                }
              },
              _embedded: {
                items: [
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object], [Object], [Object],
                  [Object], [Object], [Object], [Object]
                ]
              },
              headers: {
                date: 'Fri, 18 Nov 2022 22:59:18 GMT',
                server: 'Apache/2.4.46 (Unix)',
                'cache-control': 'no-cache, private',
                'content-security-policy': "default-src 'self' *.akeneo.com 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'nonce-07f41c14e74157aff6fa6296dac0027c13e46705'; img-src 'self' data: *.akeneo.com; frame-src *; font-src 'self' data:; connect-src 'self' *.akeneo.com",
                'x-content-security-policy': "default-src 'self' *.akeneo.com 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'nonce-07f41c14e74157aff6fa6296dac0027c13e46705'; img-src 'self' data: *.akeneo.com; frame-src *; font-src 'self' data:; connect-src 'self' *.akeneo.com",
                'x-webkit-csp': "default-src 'self' *.akeneo.com 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'nonce-07f41c14e74157aff6fa6296dac0027c13e46705'; img-src 'self' data: *.akeneo.com; frame-src *; font-src 'self' data:; connect-src 'self' *.akeneo.com",
                connection: 'close',
                'transfer-encoding': 'chunked',
                'content-type': 'application/json'
              },
              statusCode: 200
            }
            */
            /* reference entity attributes...
            [
              {
                "code": "label",
                "labels": {
                  "en_US": "Label"
                },
                "type": "text",
                "value_per_locale": true,
                "value_per_channel": false,
                "is_required_for_completeness": false,
                "max_characters": null,
                "is_textarea": false,
                "is_rich_text_editor": false,
                "validation_rule": "none",
                "validation_regexp": null,
                "_links": {
                  "self": {
                    "href": "http://localhost:8080/api/rest/v1/reference-entities/city/attributes/label"
                  }
                }
              },
              {
                "code": "image",
                "labels": {
                  "en_US": "Image"
                },
                "type": "image",
                "value_per_locale": false,
                "value_per_channel": false,
                "is_required_for_completeness": false,
                "max_file_size": "10",
                "allowed_extensions": [
                  "jpeg",
                  "jpg",
                  "png"
                ],
                "_links": {
                  "self": {
                    "href": "http://localhost:8080/api/rest/v1/reference-entities/city/attributes/image"
                  }
                }
              },
              {
                "code": "description",
                "labels": {
                  "en_US": "Description"
                },
                "type": "text",
                "value_per_locale": true,
                "value_per_channel": false,
                "is_required_for_completeness": false,
                "max_characters": null,
                "is_textarea": true,
                "is_rich_text_editor": true,
                "validation_rule": "none",
                "validation_regexp": null,
                "_links": {
                  "self": {
                    "href": "http://localhost:8080/api/rest/v1/reference-entities/city/attributes/description"
                  }
                }
              },
              {
                "code": "timezone",
                "labels": {
                  "en_US": "Timezone"
                },
                "type": "text",
                "value_per_locale": false,
                "value_per_channel": false,
                "is_required_for_completeness": false,
                "max_characters": null,
                "is_textarea": false,
                "is_rich_text_editor": false,
                "validation_rule": "none",
                "validation_regexp": null,
                "_links": {
                  "self": {
                    "href": "http://localhost:8080/api/rest/v1/reference-entities/city/attributes/timezone"
                  }
                }
              },
              {
                "code": "region",
                "labels": {
                  "en_US": "Region"
                },
                "type": "text",
                "value_per_locale": false,
                "value_per_channel": false,
                "is_required_for_completeness": false,
                "max_characters": null,
                "is_textarea": false,
                "is_rich_text_editor": false,
                "validation_rule": "none",
                "validation_regexp": null,
                "_links": {
                  "self": {
                    "href": "http://localhost:8080/api/rest/v1/reference-entities/city/attributes/region"
                  }
                }
              },
              {
                "code": "weather",
                "labels": {
                  "en_US": "Weather"
                },
                "type": "text",
                "value_per_locale": false,
                "value_per_channel": false,
                "is_required_for_completeness": false,
                "max_characters": null,
                "is_textarea": false,
                "is_rich_text_editor": false,
                "validation_rule": "none",
                "validation_regexp": null,
                "_links": {
                  "self": {
                    "href": "http://localhost:8080/api/rest/v1/reference-entities/city/attributes/weather"
                  }
                }
              },
              {
                "code": "country",
                "labels": {
                  "en_US": "Country"
                },
                "type": "text",
                "value_per_locale": false,
                "value_per_channel": false,
                "is_required_for_completeness": false,
                "max_characters": null,
                "is_textarea": false,
                "is_rich_text_editor": false,
                "validation_rule": "none",
                "validation_regexp": null,
                "_links": {
                  "self": {
                    "href": "http://localhost:8080/api/rest/v1/reference-entities/city/attributes/country"
                  }
                }
              }
            ]
            */
            if (result &&
                result._embedded &&
                result._embedded.items) {
                for (const item of result._embedded.items) {
                    delete item._links;
                    results.push(item);
                }
            }
            else if (result &&
                result.identifier) {
                delete result.headers;
                delete result.status_code;
                results.push(result);
            }
            else if (result &&
                result instanceof Array) {
                for (const element of result) {
                    results.push(element);
                }
            }
            else {
                logger.debug({ moduleName, methodName, result }, `Error: unsupported data structure.`);
                process.exit(99);
            }
            if (callback) {
                yield callback(results);
                results = [];
            }
            if (exports.getLimit > 0 &&
                exports.getLimit <= results.length) {
                url = '';
            }
            else if (result &&
                result._links &&
                result._links.next &&
                result._links.next.href) {
                url = result._links.next.href;
                const urlProtocol = url.slice(0, url.indexOf(':'));
                if (urlProtocol !== baseProtocol()) {
                    url = url.replace(urlProtocol, baseProtocol());
                }
            }
            else {
                url = '';
            }
            if (url === '') {
                if (callback) {
                    yield callback(results);
                    results = [];
                }
                break;
            }
        }
        return results;
    });
}
exports.get = get;
function patch(apiUrl, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'patch';
        logger.info({ moduleName, methodName, apiUrl }, `Starting...`);
        const dataString = JSON.stringify(data);
        logger.debug({ moduleName, methodName, dataString });
        const accessToken = yield getToken();
        return new Promise((resolve, reject) => {
            let buffer = Buffer.from('');
            const options = {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(dataString, 'utf8')
                },
                method: 'PATCH'
            };
            const url = `${exports.baseUrl}${apiUrl}`;
            const request = protocol.request(url, options, (response) => __awaiter(this, void 0, void 0, function* () {
                const statusCode = response.statusCode;
                const headers = response.headers;
                logger.debug({ moduleName, methodName, statusCode, headers });
                if (statusCode &&
                    statusCode > 299) {
                    logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
                }
                response.on('data', (data) => {
                    logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString() });
                    buffer = buffer.length > 0 ? Buffer.concat([buffer, data]) : data;
                });
                response.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString() });
                    if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                        const fileDescriptor = yield open(path.join(exports.exportPath, 'patchReponse.txt'), 'a');
                        yield write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield close(fileDescriptor);
                    }
                    let results = { statusCode };
                    if (buffer.length > 0) {
                        try {
                            results = JSON.parse(buffer.toString());
                            results.statusCode = response.statusCode;
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString() });
                            const html = buffer.toString('utf8');
                            results = {
                                html,
                                headers,
                                statusCode
                            };
                            return resolve(results);
                        }
                    }
                    return resolve(results);
                }));
            }));
            request.on('error', (err) => {
                logger.error({ moduleName, methodName, event: 'error', err });
                return reject(err);
            });
            request.write(dataString);
            request.end();
        });
    });
}
exports.patch = patch;
function patchVndAkeneoCollection(apiUrl, docs) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'patchVndAkeneoCollection';
        logger.info({ moduleName, methodName, apiUrl, docs: docs.length }, `Starting...`);
        const results = {
            responses: [],
            statusCode: -1
        };
        let dataArray = [];
        let dataString = '';
        for (let i = 0; i < docs.length; i++) {
            dataArray.push(JSON.stringify(docs[i]));
            if ((1 + i) % exports.patchLimit === 0 ||
                1 + i === docs.length) {
                dataString = `${dataArray.join('\n')}`;
                const accessToken = yield getToken();
                const result = yield new Promise((resolve, reject) => {
                    let buffer = Buffer.from('');
                    const options = {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/vnd.akeneo.collection+json',
                            'Content-Length': Buffer.byteLength(dataString, 'utf8')
                        },
                        method: 'PATCH'
                    };
                    const url = `${exports.baseUrl}${apiUrl}`;
                    const request = protocol.request(url, options, (response) => __awaiter(this, void 0, void 0, function* () {
                        const statusCode = response.statusCode;
                        const headers = response.headers;
                        if (statusCode &&
                            statusCode > 299) {
                            logger.error({ moduleName, methodName, statusCode, headers, url, dataString }, `Error: ${response.statusMessage}`);
                        }
                        if (statusCode === 502) {
                            // bad gateway
                            tokenResponse = null;
                        }
                        response.on('data', (data) => {
                            logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString() });
                            buffer = buffer.length > 0 ? Buffer.concat([buffer, data]) : data;
                        });
                        response.on('end', () => __awaiter(this, void 0, void 0, function* () {
                            logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString() });
                            if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                                const fileDescriptor = yield open(path.join(exports.exportPath, 'patchVndAkeneoCollectionReponse.txt'), 'a');
                                yield write(fileDescriptor, buffer.toString('utf8') + '\n');
                                yield close(fileDescriptor);
                            }
                            let results = { statusCode: response.statusCode };
                            if (buffer.length > 0) {
                                // a sample response with an errors array
                                // {"line":1,"code":"brooksblue","status_code":422,"message":"Validation failed.","errors":[{"property":"values","message":"The blue value is not in the color attribute option list.","attribute":"color","locale":null,"scope":null}],"data":"{\"code\":\"brooksblue\",\"family\":\"shoes\",\"family_variant\":\"shoes_size\",\"parent\":null,\"categories\":[\"master_men_shoes\"],\"values\":{\"color\":[{\"locale\":null,\"scope\":null,\"data\":\"blue\"}],\"collection\":[{\"locale\":null,\"scope\":null,\"data\":[\"summer_2017\"]}],\"name\":[{\"locale\":null,\"scope\":null,\"data\":\"Brooks blue\"}],\"erp_name\":[{\"locale\":\"en_US\",\"scope\":null,\"data\":\"Brooks blue\"}],\"variation_name\":[{\"locale\":\"en_US\",\"scope\":null,\"data\":\"Brooks blue\"}],\"description\":[{\"locale\":\"en_US\",\"scope\":\"ecommerce\",\"data\":\"Brooks blue\"}]},\"created\":\"2022-12-12T17:20:01+00:00\",\"updated\":\"2022-12-12T17:20:01+00:00\",\"associations\":{\"PACK\":{\"products\":[],\"product_models\":[],\"groups\":[]},\"SUBSTITUTION\":{\"products\":[],\"product_models\":[],\"groups\":[]},\"UPSELL\":{\"products\":[],\"product_models\":[],\"groups\":[]},\"X_SELL\":{\"products\":[],\"product_models\":[],\"groups\":[]}},\"quantified_associations\":{}}"}
                                // a sample response without an errors array
                                // {"line":1,"identifier":"Tshirt-divided-grey-m","status_code":422,"message":"Property \"variation_image\" expects a valid pathname as data, \"/2/b/8/6/2b86a042aac14a9fd28feaf3ca25a147259e49fb_grey.png\" given. Check the expected format on the API documentation.","_links":{"documentation":{"href":"http://api.akeneo.com/api-reference.html#patch_products__code_"}},"data":"{\"identifier\":\"Tshirt-divided-grey-m\",\"values\":{\"variation_image\":[{\"locale\":null,\"scope\":null,\"data\":\"/2/b/8/6/2b86a042aac14a9fd28feaf3ca25a147259e49fb_grey.png\"}]}}"}
                                try {
                                    results.responses = JSON.parse(`[ ${buffer.toString().replace(/\n/g, ',')} ]`);
                                    for (const response of results.responses) {
                                        if (response.line !== undefined &&
                                            response.status_code !== undefined &&
                                            response.status_code > 299) {
                                            response.data = dataArray[response.line - 1];
                                            logger.error({ moduleName, methodName, response }, `Error`);
                                        }
                                    }
                                    results.statusCode = response.statusCode;
                                }
                                catch (err) {
                                    logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString() });
                                    const html = buffer.toString('utf8');
                                    results = {
                                        html,
                                        headers,
                                        statusCode
                                    };
                                    return resolve(results);
                                }
                            }
                            return resolve(results);
                        }));
                    }));
                    request.on('error', (err) => {
                        logger.error({ moduleName, methodName, event: 'error', err });
                        return reject(err);
                    });
                    request.write(dataString);
                    request.end();
                }); // promise
                if (result &&
                    result.responses !== undefined &&
                    result.statusCode !== undefined) {
                    for (const response of result.responses) {
                        results.responses.push(response);
                    }
                    if (results.statusCode < result.statusCode) {
                        results.statusCode = result.statusCode;
                    }
                }
                dataArray = [];
            } // if
        } // for
        return results;
    });
}
exports.patchVndAkeneoCollection = patchVndAkeneoCollection;
function post(apiUrl, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'post';
        logger.debug({ moduleName, methodName, apiUrl }, `Starting...`);
        const dataString = JSON.stringify(data);
        const accessToken = yield getToken();
        return new Promise((resolve, reject) => {
            let buffer = Buffer.from('');
            const options = {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(dataString, 'utf8')
                },
                method: 'POST'
            };
            const url = `${exports.baseUrl}${apiUrl}`;
            const request = protocol.request(url, options, (response) => __awaiter(this, void 0, void 0, function* () {
                const statusCode = response.statusCode;
                const headers = response.headers;
                if (statusCode &&
                    statusCode > 299) {
                    logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
                }
                response.on('data', (data) => {
                    logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString() });
                    buffer = buffer.length > 0 ? Buffer.concat([buffer, data]) : data;
                });
                response.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString() });
                    if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                        const fileDescriptor = yield open(path.join(exports.exportPath, 'postReponse.txt'), 'a');
                        yield write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield close(fileDescriptor);
                    }
                    let results = { statusCode };
                    if (buffer.length > 0) {
                        try {
                            results = JSON.parse(buffer.toString());
                            results.statusCode = response.statusCode;
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString() });
                            const html = buffer.toString('utf8');
                            results = {
                                html,
                                headers,
                                statusCode
                            };
                            return resolve(results);
                        }
                    }
                    return resolve(results);
                }));
            }));
            request.on('error', (err) => {
                logger.error({ moduleName, methodName, event: 'error', err });
                return reject(err);
            });
            request.write(dataString);
            request.end();
        });
    });
}
exports.post = post;
// https://www.npmjs.com/package/form-data
function postMultipartFormData(apiUrl, stream, properties = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'postMultipartFormData';
        logger.info({ moduleName, methodName, apiUrl }, `Starting...`);
        const accessToken = yield getToken();
        return new Promise((resolve, reject) => {
            if (!(stream)) {
                logger.error({ moduleName, methodName, apiUrl: apiUrl }, `No Stream`);
                reject('');
            }
            const splitBaseUrl = exports.baseUrl.split('/');
            const splitHost = splitBaseUrl[2].split(':');
            const host = splitHost[0];
            const port = Number.parseInt(splitHost[1] ? splitHost[1] : splitBaseUrl[0] === 'https:' ? '443' : '80');
            const protocol = splitBaseUrl[0];
            const options = {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                host,
                path: apiUrl,
                port,
                protocol
            };
            const form = new FormData();
            form.append('file', stream);
            if (properties.identifier) {
                form.append('product', JSON.stringify(properties));
            }
            else if (properties.code) {
                form.append('product_model', JSON.stringify(properties));
            }
            form.submit(options, (err, response) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    const error = err.message ? err.message : inspect(err);
                    logger.error({ moduleName, methodName, apiUrl: apiUrl, error }, `Error`);
                    reject(err);
                }
                else {
                    const statusCode = response.statusCode;
                    const statusMessage = response.statusMessage;
                    logger.info({ moduleName, methodName, apiUrl, statusCode });
                    logger.info({ moduleName, methodName, apiUrl, statusMessage });
                    if (statusCode !== 201) {
                        logger.error({ moduleName, methodName, apiUrl, stream });
                        logger.error({ moduleName, methodName, apiUrl, properties });
                        //const object: any = response;
                        //for (const property in object) {
                        //  if (object.hasOwnProperty(property)) {
                        //    const value: any = object[property];
                        //    logger.error({ moduleName, methodName, apiUrl: apiUrl, property, value });
                        //  }
                        //}
                    }
                    const headers = response.headers;
                    if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                        const fileDescriptor = yield open(path.join(exports.exportPath, 'postMultipartFormDataReponse.txt'), 'a');
                        yield write(fileDescriptor, inspect(response.headers));
                        yield close(fileDescriptor);
                    }
                    let location = '';
                    if (headers['location']) {
                        location = headers['location'];
                        logger.info({ moduleName, methodName, apiUrl: apiUrl, location });
                    }
                    let assetMediaFileCode = '';
                    if (headers['asset-media-file-code']) {
                        assetMediaFileCode = headers['asset-media-file-code'];
                        logger.info({ moduleName, methodName, apiUrl: apiUrl, assetMediaFileCode });
                    }
                    let referenceEntitiesMediaFileCode = '';
                    if (headers['reference-entities-media-file-code']) {
                        referenceEntitiesMediaFileCode = headers['reference-entities-media-file-code'];
                        logger.info({ moduleName, methodName, apiUrl: apiUrl, referenceEntitiesMediaFileCode });
                    }
                    if (statusCode !== 201) {
                        reject(`${statusCode}: ${statusMessage}`);
                    }
                    else if (assetMediaFileCode) {
                        resolve(assetMediaFileCode);
                    }
                    else if (referenceEntitiesMediaFileCode) {
                        resolve(referenceEntitiesMediaFileCode);
                    }
                    else {
                        resolve(location);
                    }
                }
            }));
        });
    });
}
exports.postMultipartFormData = postMultipartFormData;
function exportAssociationTypes() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssociationTypes';
        logger.info({ moduleName, methodName }, 'Starting...');
        let associationTypes;
        try {
            associationTypes = yield get(apiUrlAssociationTypes());
            logger.debug({ moduleName, methodName, associationTypes });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (associationTypes !== null &&
            typeof associationTypes[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssociationTypes);
            const fileDesc = yield open(fileName, 'w');
            for (const associationType of associationTypes) {
                yield write(fileDesc, Buffer.from(JSON.stringify(associationType) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssociationTypes = exportAssociationTypes;
function exportAttributes() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAttributes';
        logger.info({ moduleName, methodName }, 'Starting...');
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameAttributeOptions));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        const attributes = yield get(apiUrlAttributes());
        logger.debug({ moduleName, methodName, attributes });
        if (attributes !== null &&
            typeof attributes[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAttributes);
            const fileDesc = yield open(fileName, 'w');
            for (const attribute of attributes) {
                yield write(fileDesc, Buffer.from(JSON.stringify(attribute) + '\n'));
                if (attribute.type === 'pim_catalog_simpleselect' ||
                    attribute.type === 'pim_catalog_multiselect') {
                    try {
                        yield exportAttributeOptions(attribute.code);
                    }
                    catch (err) {
                        logger.info({ moduleName, methodName, err });
                        return err;
                    }
                }
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAttributes = exportAttributes;
function exportAttributeGroups() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAttributeGroups';
        logger.info({ moduleName, methodName }, 'Starting...');
        let attributeGroups;
        try {
            attributeGroups = yield get(apiUrlAttributeGroups());
            logger.debug({ moduleName, methodName, attributeGroups });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (attributeGroups !== null &&
            typeof attributeGroups[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAttributeGroups);
            const fileDesc = yield open(fileName, 'w');
            for (const attributeGroup of attributeGroups) {
                yield write(fileDesc, Buffer.from(JSON.stringify(attributeGroup) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAttributeGroups = exportAttributeGroups;
function exportAttributeOptions(attributeCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAttributeOptions';
        logger.info({ moduleName, methodName, attributeCode }, 'Starting...');
        let attributeOptions;
        try {
            attributeOptions = yield get(apiUrlAttributeOptions(attributeCode));
            logger.debug({ moduleName, methodName, attributeOptions });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (attributeOptions !== null &&
            typeof attributeOptions[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAttributeOptions);
            const fileDesc = yield open(fileName, 'a');
            for (const attributeOption of attributeOptions) {
                yield write(fileDesc, Buffer.from(JSON.stringify(attributeOption) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAttributeOptions = exportAttributeOptions;
function exportCategories() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportCategories';
        logger.info({ moduleName, methodName }, 'Starting...');
        let categories;
        try {
            categories = yield get(apiUrlCategories());
            logger.debug({ moduleName, methodName, categories });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (categories !== null &&
            typeof categories[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameCategories);
            const fileDesc = yield open(fileName, 'w');
            for (const category of categories) {
                yield write(fileDesc, Buffer.from(JSON.stringify(category) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportCategories = exportCategories;
function exportChannels() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportChannels';
        logger.info({ moduleName, methodName }, 'Starting...');
        let channels;
        try {
            channels = yield get(apiUrlChannels());
            logger.debug({ moduleName, methodName, channels });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (channels !== null &&
            typeof channels[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameChannels);
            const fileDesc = yield open(fileName, 'w');
            for (const channel of channels) {
                yield write(fileDesc, Buffer.from(JSON.stringify(channel) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportChannels = exportChannels;
function exportCurrencies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportCurrencies';
        logger.info({ moduleName, methodName }, 'Starting...');
        let currencies;
        try {
            currencies = yield get(apiUrlCurrencies());
            logger.debug({ moduleName, methodName, currencies });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (currencies !== null &&
            typeof currencies[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameCurrencies);
            const fileDesc = yield open(fileName, 'w');
            for (const currency of currencies) {
                yield write(fileDesc, Buffer.from(JSON.stringify(currency) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportCurrencies = exportCurrencies;
function exportFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameFamilyVariants));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        let families;
        try {
            families = yield get(apiUrlFamilies());
            logger.debug({ moduleName, methodName, families });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (families !== null &&
            typeof families[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameFamilies);
            const fileDesc = yield open(fileName, 'w');
            for (const family of families) {
                if (family.code) {
                    yield write(fileDesc, Buffer.from(JSON.stringify(family) + '\n'));
                    try {
                        yield exportFamilyVariants(family.code);
                    }
                    catch (err) {
                        logger.info({ moduleName, methodName, err });
                        return err;
                    }
                }
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportFamilies = exportFamilies;
function exportFamilyVariants(familyCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportFamilyVariants';
        logger.info({ moduleName, methodName, familyCode }, 'Starting...');
        let familyVariants;
        try {
            familyVariants = yield get(apiUrlFamilyVariants(familyCode));
            logger.debug({ moduleName, methodName, familyVariants });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (familyVariants !== null &&
            typeof familyVariants[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameFamilyVariants);
            const fileDesc = yield open(fileName, 'a');
            for (const familyVariant of familyVariants) {
                // NOTE: I had to add attribute family. Even though the doc says it's
                //       not needed, it doesn't work without it.
                if (!(familyVariant.family)) {
                    familyVariant.family = familyCode;
                }
                yield write(fileDesc, Buffer.from(JSON.stringify(familyVariant) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportFamilyVariants = exportFamilyVariants;
function exportGroups() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportGroups';
        logger.info({ moduleName, methodName }, 'Starting...');
        let Groups;
        try {
            Groups = yield get(apiUrlGroups());
            logger.debug({ moduleName, methodName, Groups });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (Groups !== null &&
            typeof Groups[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameGroups);
            const fileDesc = yield open(fileName, 'w');
            for (const Group of Groups) {
                yield write(fileDesc, Buffer.from(JSON.stringify(Group) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportGroups = exportGroups;
function exportLocales() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportLocales';
        logger.info({ moduleName, methodName }, 'Starting...');
        let locales;
        try {
            locales = yield get(apiUrlLocales());
            logger.debug({ moduleName, methodName, locales });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (locales !== null &&
            typeof locales[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameLocales);
            const fileDesc = yield open(fileName, 'w');
            for (const locale of locales) {
                yield write(fileDesc, Buffer.from(JSON.stringify(locale) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportLocales = exportLocales;
function exportMeasureFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportMeasureFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        let measureFamilies;
        try {
            measureFamilies = yield get(apiUrlMeasureFamilies());
            logger.debug({ moduleName, methodName, measureFamilies });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (measureFamilies !== null &&
            typeof measureFamilies[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameMeasureFamilies);
            const fileDesc = yield open(fileName, 'w');
            for (const measureFamily of measureFamilies) {
                yield write(fileDesc, Buffer.from(JSON.stringify(measureFamily) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportMeasureFamilies = exportMeasureFamilies;
function exportMeasurementFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportMeasurementFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        let measurementFamilies;
        try {
            measurementFamilies = yield get(apiUrlMeasurementFamilies());
            logger.debug({ moduleName, methodName, measurementFamilies });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (measurementFamilies !== null &&
            typeof measurementFamilies[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameMeasurementFamilies);
            const fileDesc = yield open(fileName, 'w');
            for (const measurementFamily of measurementFamilies) {
                yield write(fileDesc, Buffer.from(JSON.stringify(measurementFamily) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportMeasurementFamilies = exportMeasurementFamilies;
function exportProducts(parameters = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportProducts';
        logger.info({ moduleName, methodName }, 'Starting...');
        let products;
        const fileName = path.join(exports.exportPath, exports.filenameProducts);
        const fileDesc = yield open(fileName, 'w');
        let count = 0;
        try {
            products = yield get(parameters ?
                `${apiUrlProducts()}?pagination_type=search_after&${parameters}` :
                `${apiUrlProducts()}?pagination_type=search_after`, (results) => __awaiter(this, void 0, void 0, function* () {
                let vac = '';
                for (const result of results) {
                    vac += JSON.stringify(result) + '\n';
                    ++count;
                }
                const buffer = Buffer.from(vac);
                yield write(fileDesc, buffer);
            }));
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        logger.info({ moduleName, methodName, products: count });
        yield close(fileDesc);
        logger.info({ moduleName, methodName }, 'Exporting linked images...');
        const productMediaFilesMap = new Map();
        let stats = yield stat(path.join(exports.exportPath, exports.filenameProductMediaFiles));
        if (stats) {
            yield load(path.join(exports.exportPath, exports.filenameProductMediaFiles), productMediaFilesMap, 'fromHref');
        }
        const productsMap = new Map();
        yield load(fileName, productsMap, 'identifier');
        for (const product of productsMap.values()) {
            const valueAttributes = product.values ? product.values : {};
            for (const valueAttribute in valueAttributes) {
                for (const valueObject of valueAttributes[valueAttribute]) {
                    if (valueObject.data &&
                        valueObject._links &&
                        valueObject._links.download &&
                        valueObject._links.download.href) {
                        const data = valueObject.data || '';
                        const href = valueObject._links.download.href || '';
                        if (!(productMediaFilesMap.has(href))) {
                            const downloadResults = yield download(data, href);
                            if (downloadResults === OK) {
                                productMediaFilesMap.set(href, { fromData: data, fromHref: href });
                            }
                        }
                    }
                }
            }
        }
        const mediaFileDesc = yield open(path.join(exports.exportPath, exports.filenameProductMediaFiles), 'w');
        for (const productMediaFile of productMediaFilesMap.values()) {
            yield write(mediaFileDesc, `${JSON.stringify(productMediaFile)}\n`);
        }
        yield close(mediaFileDesc);
        return count;
    });
}
exports.exportProducts = exportProducts;
function exportProductModels() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportProductModels';
        logger.info({ moduleName, methodName }, 'Starting...');
        let productModels;
        const fileName = path.join(exports.exportPath, exports.filenameProductModels);
        const fileDesc = yield open(fileName, 'w');
        let count = 0;
        try {
            productModels = yield get(`${apiUrlProductModels()}?pagination_type=search_after`, (results) => __awaiter(this, void 0, void 0, function* () {
                let vac = '';
                for (const result of results) {
                    vac += JSON.stringify(result) + '\n';
                    ++count;
                }
                const buffer = Buffer.from(vac);
                yield write(fileDesc, buffer);
            }));
            logger.debug({ moduleName, methodName, productModels });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        logger.info({ moduleName, methodName, productModels: count });
        yield close(fileDesc);
        logger.info({ moduleName, methodName }, 'Exporting linked images...');
        const productMediaFilesMap = new Map();
        let stats = yield stat(path.join(exports.exportPath, exports.filenameProductMediaFiles));
        if (stats) {
            yield load(path.join(exports.exportPath, exports.filenameProductMediaFiles), productMediaFilesMap, 'fromHref');
        }
        const productModelsMap = new Map();
        yield load(fileName, productModelsMap, 'code');
        for (const productModel of productModelsMap.values()) {
            const valueAttributes = productModel.values ? productModel.values : {};
            for (const valueAttribute in valueAttributes) {
                for (const valueObject of valueAttributes[valueAttribute]) {
                    if (valueObject.data &&
                        valueObject._links &&
                        valueObject._links.download &&
                        valueObject._links.download.href) {
                        const data = valueObject.data || '';
                        const href = valueObject._links.download.href || '';
                        if (!(productMediaFilesMap.has(href))) {
                            const downloadResults = yield download(data, href);
                            if (downloadResults === OK) {
                                productMediaFilesMap.set(href, { fromData: data, fromHref: href });
                            }
                        }
                    }
                }
            }
        }
        const mediaFileDesc = yield open(path.join(exports.exportPath, exports.filenameProductMediaFiles), 'w');
        for (const productMediaFile of productMediaFilesMap.values()) {
            yield write(mediaFileDesc, `${JSON.stringify(productMediaFile)}\n`);
        }
        yield close(mediaFileDesc);
        return count;
    });
}
exports.exportProductModels = exportProductModels;
// TODO: export function exportPublishedProduct(): Promise<any>
// TODO: export function exportProductMediaFile(): Promise<any>
/******************** R E F E R E N C E   E N T I T I E S ********************/
function exportReferenceEntities() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportReferenceEntities';
        logger.info({ moduleName, methodName }, 'Starting...');
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameReferenceEntityAttributes));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameReferenceEntityAttributeOptions));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameReferenceEntityRecords));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        let referenceEntities;
        try {
            referenceEntities = yield get(apiUrlReferenceEntities());
            logger.debug({ moduleName, methodName, referenceEntities });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (referenceEntities !== null &&
            typeof referenceEntities[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameReferenceEntities);
            const fileDesc = yield open(fileName, 'w');
            for (const referenceEntity of referenceEntities) {
                yield write(fileDesc, Buffer.from(JSON.stringify(referenceEntity) + '\n'));
                try {
                    yield exportReferenceEntityAttributes(referenceEntity.code);
                }
                catch (err) {
                    logger.info({ moduleName, methodName, err });
                    return err;
                }
                try {
                    yield exportReferenceEntityRecords(referenceEntity.code);
                }
                catch (err) {
                    logger.info({ moduleName, methodName, err });
                    return err;
                }
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportReferenceEntities = exportReferenceEntities;
function exportReferenceEntityAttributes(referenceEntityCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportReferenceEntityAttributes';
        logger.info({ moduleName, methodName }, 'Starting...');
        let referenceEntityAttributes;
        try {
            referenceEntityAttributes = yield get(apiUrlReferenceEntityAttributes(referenceEntityCode));
            logger.debug({ moduleName, methodName, referenceEntityAttributes });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (referenceEntityAttributes !== null &&
            typeof referenceEntityAttributes[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameReferenceEntityAttributes);
            const fileDesc = yield open(fileName, 'a');
            for (const referenceEntityAttribute of referenceEntityAttributes) {
                if (!(referenceEntityAttribute.delete_reference_entity_code)) {
                    referenceEntityAttribute.delete_reference_entity_code = referenceEntityCode;
                }
                yield write(fileDesc, Buffer.from(JSON.stringify(referenceEntityAttribute) + '\n'));
                if (referenceEntityAttribute.type === 'multiple_options' ||
                    referenceEntityAttribute.type === 'single_option') {
                    try {
                        yield exportReferenceEntityAttributeOptions(referenceEntityCode, referenceEntityAttribute.code);
                    }
                    catch (err) {
                        logger.info({ moduleName, methodName, err });
                        return err;
                    }
                }
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportReferenceEntityAttributes = exportReferenceEntityAttributes;
function exportReferenceEntityAttributeOptions(referenceEntityCode, attributeCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportReferenceEntityAttributeOptions';
        logger.info({ moduleName, methodName }, 'Starting...');
        let referenceEntityAttributeOptions = [];
        try {
            referenceEntityAttributeOptions = yield get(apiUrlReferenceEntityAttributeOptions(referenceEntityCode, attributeCode));
            logger.debug({ moduleName, methodName, referenceEntityAttributeOptions });
        }
        catch (err) {
            if (err.code && err.code !== 404) {
                logger.info({ moduleName, methodName, err });
                return err;
            }
        }
        if (referenceEntityAttributeOptions !== null &&
            typeof referenceEntityAttributeOptions[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameReferenceEntityAttributeOptions);
            const fileDesc = yield open(fileName, 'a');
            for (const referenceEntityAttributeOption of referenceEntityAttributeOptions) {
                if (!(referenceEntityAttributeOption.delete_reference_entity_code)) {
                    referenceEntityAttributeOption.delete_reference_entity_code = referenceEntityCode;
                }
                if (!(referenceEntityAttributeOption.delete_attribute_code)) {
                    referenceEntityAttributeOption.delete_attribute_code = attributeCode;
                }
                yield write(fileDesc, Buffer.from(JSON.stringify(referenceEntityAttributeOption) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportReferenceEntityAttributeOptions = exportReferenceEntityAttributeOptions;
function exportReferenceEntityRecords(referenceEntityCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportReferenceEntityRecords';
        logger.info({ moduleName, methodName }, 'Starting...');
        let referenceEntityRecords;
        try {
            referenceEntityRecords = yield get(apiUrlReferenceEntityRecords(referenceEntityCode));
            logger.debug({ moduleName, methodName, referenceEntityRecords });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (referenceEntityRecords !== null &&
            typeof referenceEntityRecords[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameReferenceEntityRecords);
            const fileDesc = yield open(fileName, 'a');
            for (const referenceEntityRecord of referenceEntityRecords) {
                if (!(referenceEntityRecord.delete_reference_entity_code)) {
                    referenceEntityRecord.delete_reference_entity_code = referenceEntityCode;
                }
                yield write(fileDesc, Buffer.from(JSON.stringify(referenceEntityRecord) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportReferenceEntityRecords = exportReferenceEntityRecords;
// TODO: export function exportReferenceEntityMediaFile(): Promise<any>
/******************** A S S E T   F A M I L I E S ********************/
function exportAssetFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssetFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameAssetFamilyAttributes));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameAssetFamilyAttributeOptions));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield unlink(path.join(exports.exportPath, exports.filenameAssetFamilyAssets));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        let assetFamilies;
        try {
            assetFamilies = yield get(apiUrlAssetFamilies());
            logger.debug({ moduleName, methodName, assetFamilies });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (assetFamilies !== null &&
            typeof assetFamilies[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssetFamilies);
            const fileDesc = yield open(fileName, 'w');
            for (const assetFamily of assetFamilies) {
                yield write(fileDesc, Buffer.from(JSON.stringify(assetFamily) + '\n'));
                try {
                    yield exportAssetFamilyAttributes(assetFamily.code);
                }
                catch (err) {
                    logger.info({ moduleName, methodName, err });
                    return err;
                }
                try {
                    yield exportAssetFamilyAssets(assetFamily.code);
                }
                catch (err) {
                    logger.info({ moduleName, methodName, err });
                    return err;
                }
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssetFamilies = exportAssetFamilies;
function exportAssetFamilyAttributes(assetFamilyCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssetFamilyAttributes';
        logger.info({ moduleName, methodName }, 'Starting...');
        let assetFamilyAttributes;
        try {
            assetFamilyAttributes = yield get(apiUrlAssetFamilyAttributes(assetFamilyCode));
            logger.debug({ moduleName, methodName, assetFamilyAttributes });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (assetFamilyAttributes !== null &&
            typeof assetFamilyAttributes[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssetFamilyAttributes);
            const fileDesc = yield open(fileName, 'a');
            for (const assetFamilyAttribute of assetFamilyAttributes) {
                if (!(assetFamilyAttribute.delete_asset_family_code)) {
                    assetFamilyAttribute.delete_asset_family_code = assetFamilyCode;
                }
                yield write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAttribute) + '\n'));
                if (assetFamilyAttribute.type === 'multiple_options' ||
                    assetFamilyAttribute.type === 'single_option') {
                    try {
                        yield exportAssetFamilyAttributeOptions(assetFamilyCode, assetFamilyAttribute.code);
                    }
                    catch (err) {
                        logger.info({ moduleName, methodName, err });
                        return err;
                    }
                }
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssetFamilyAttributes = exportAssetFamilyAttributes;
function exportAssetFamilyAttributeOptions(assetFamilyCode, attributeCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssetFamilyAttributeOptions';
        logger.info({ moduleName, methodName }, 'Starting...');
        let assetFamilyAttributeOptions = [];
        try {
            assetFamilyAttributeOptions = yield get(apiUrlAssetFamilyAttributeOptions(assetFamilyCode, attributeCode));
            logger.debug({ moduleName, methodName, assetFamilyAttributeOptions });
        }
        catch (err) {
            if (err.code && err.code !== 404) {
                logger.info({ moduleName, methodName, err });
                return err;
            }
        }
        if (assetFamilyAttributeOptions !== null &&
            typeof assetFamilyAttributeOptions[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssetFamilyAttributeOptions);
            const fileDesc = yield open(fileName, 'a');
            for (const assetFamilyAttributeOption of assetFamilyAttributeOptions) {
                if (!(assetFamilyAttributeOption.delete_asset_family_code)) {
                    assetFamilyAttributeOption.delete_asset_family_code = assetFamilyCode;
                }
                if (!(assetFamilyAttributeOption.delete_attribute_code)) {
                    assetFamilyAttributeOption.delete_attribute_code = attributeCode;
                }
                yield write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAttributeOption) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssetFamilyAttributeOptions = exportAssetFamilyAttributeOptions;
function exportAssetFamilyAssets(assetFamilyCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssetFamilyAssets';
        logger.info({ moduleName, methodName }, 'Starting...');
        let assetFamilyAssets;
        try {
            assetFamilyAssets = yield get(apiUrlAssetFamilyAssets(assetFamilyCode));
            logger.debug({ moduleName, methodName, assetFamilyAssets });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (assetFamilyAssets !== null &&
            typeof assetFamilyAssets[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssetFamilyAssets);
            const fileDesc = yield open(fileName, 'a');
            for (const assetFamilyAsset of assetFamilyAssets) {
                if (!(assetFamilyAsset.delete_asset_family_code)) {
                    assetFamilyAsset.delete_asset_family_code = assetFamilyCode;
                }
                yield write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAsset) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssetFamilyAssets = exportAssetFamilyAssets;
// TODO: export function exportMediaFiles(): Promise<any>
function exportProductMediaFiles(code = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportProductMediaFiles';
        logger.info({ moduleName, methodName }, 'Starting...');
        let mediaFiles = [];
        try {
            mediaFiles = yield get(apiUrlProductMediaFiles(code));
            logger.debug({ moduleName, methodName, mediaFiles });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (mediaFiles !== null &&
            typeof mediaFiles[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameProductMediaFiles);
            const fileDesc = yield open(fileName, 'a');
            for (const mediaFile of mediaFiles) {
                //      if (!(mediaFile.delete_asset_family_code)) {
                //        mediaFile.delete_asset_family_code = assetFamilyCode;
                //      }
                yield write(fileDesc, Buffer.from(JSON.stringify(mediaFile) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportProductMediaFiles = exportProductMediaFiles;
// TODO: PAM exports
function exportAssets() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssets';
        logger.info({ moduleName, methodName }, 'Starting...');
        let assets;
        try {
            assets = yield get(apiUrlAssets());
            logger.debug({ moduleName, methodName, assets });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (assets !== null &&
            typeof assets[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssets);
            const fileDesc = yield open(fileName, 'w');
            for (const asset of assets) {
                yield write(fileDesc, Buffer.from(JSON.stringify(asset) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssets = exportAssets;
function exportAssetCategories() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssetCategories';
        logger.info({ moduleName, methodName }, 'Starting...');
        let assetCategories;
        try {
            assetCategories = yield get(apiUrlAssetCategories());
            logger.debug({ moduleName, methodName, assetCategories });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (assetCategories !== null &&
            typeof assetCategories[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssetCategories);
            const fileDesc = yield open(fileName, 'w');
            for (const assetCategory of assetCategories) {
                yield write(fileDesc, Buffer.from(JSON.stringify(assetCategory) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssetCategories = exportAssetCategories;
// export async function exportAssetReferenceFiles(): Promise<any> {
function exportAssetTags() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportAssetTags';
        logger.info({ moduleName, methodName }, 'Starting...');
        let assetTags;
        try {
            assetTags = yield get(apiUrlAssetTags());
            logger.debug({ moduleName, methodName, assetTags });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (assetTags !== null &&
            typeof assetTags[Symbol.iterator] === 'function') {
            const fileName = path.join(exports.exportPath, exports.filenameAssetTags);
            const fileDesc = yield open(fileName, 'w');
            for (const assetTag of assetTags) {
                yield write(fileDesc, Buffer.from(JSON.stringify(assetTag) + '\n'));
            }
            yield close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssetTags = exportAssetTags;
// export async function exportAssetVariationFiles(): Promise<any> {
/******************************************************************************
                     I M P O R T   F U N C T I O N S
******************************************************************************/
function importAssociationTypes() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAssociationTypes';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAssociationTypes);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const associationTypes = JSON.parse(`[ ${buffer} ]`);
            const results = yield patchVndAkeneoCollection(apiUrlAssociationTypes(), associationTypes);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importAssociationTypes = importAssociationTypes;
function importAttributes() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAttributes';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAttributes);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const attributes = JSON.parse(`[ ${buffer} ]`);
            // pim 6 introduced property group_labels, which doesn't exist in the pim, so delete it.
            for (const attribute of attributes) {
                delete attribute.group_labels;
            }
            const results = yield patchVndAkeneoCollection(apiUrlAttributes(), attributes);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importAttributes = importAttributes;
function importAttributeGroups() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAttributeGroups';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAttributeGroups);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const attributeGroups = JSON.parse(`[ ${buffer} ]`);
            // attribute groups point to attributes, and attributes point to attribute groups, so let's unlink attribute groups.
            for (const attributeGroup of attributeGroups) {
                attributeGroup.attributes = [];
            }
            const results = yield patchVndAkeneoCollection(apiUrlAttributeGroups(), attributeGroups);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importAttributeGroups = importAttributeGroups;
function importAttributeOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAttributeOptions';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAttributeOptions);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const attributeOptions = JSON.parse(`[ ${buffer} ]`);
            attributeOptions.sort((a, b) => {
                return a.attribute < b.attribute ? -1 :
                    a.attribute > b.attribute ? 1 :
                        a.code < b.code ? -1 :
                            a.code > b.code ? 1 : 0;
            });
            if (attributeOptions.length > 0 &&
                attributeOptions[0].attribute) {
                let attributeCode = attributeOptions[0].attribute || '';
                let attributeCodeAttributeOptions = [];
                for (let i = 0; i < attributeOptions.length; i++) {
                    if (attributeCode !== attributeOptions[i].attribute ||
                        (i + 1) === attributeOptions.length) {
                        const results = yield patchVndAkeneoCollection(apiUrlAttributeOptions(attributeCode), attributeCodeAttributeOptions);
                        logger.debug({ moduleName, methodName, results });
                        attributeCode = attributeOptions[i].attribute || '';
                        attributeCodeAttributeOptions = [];
                    }
                    const attributeOption = attributeOptions[i];
                    attributeCodeAttributeOptions.push(attributeOption);
                }
                if (attributeCodeAttributeOptions.length > 0) {
                    const results = yield patchVndAkeneoCollection(apiUrlAttributeOptions(attributeCode), attributeCodeAttributeOptions);
                    logger.debug({ moduleName, methodName, results });
                    if (results.responses &&
                        results.responses instanceof Array) {
                        for (const response of results.responses) {
                            let message = response.code ? `Code: ${response.code}: ` : '';
                            message += response.message ? `${response.message} ` : '';
                            if (response.errors &&
                                response.errors instanceof Array) {
                                for (const error of response.errors) {
                                    message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                                    message += error.message ? `${error.message} ` : '';
                                }
                            }
                            if (response.status_code > 299) {
                                logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                            }
                        }
                    }
                }
            }
        }
        return OK;
    });
}
exports.importAttributeOptions = importAttributeOptions;
function importCategories() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importCategories';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameCategories);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const categories = JSON.parse(`[ ${buffer} ]`);
            // pim 6 added property updated, but it doesn't exist, so delete it.
            for (const category of categories) {
                delete category.updated;
            }
            const results = yield patchVndAkeneoCollection(apiUrlCategories(), categories);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importCategories = importCategories;
function importChannels() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importChannels';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameChannels);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const channels = JSON.parse(`[ ${buffer} ]`);
            const results = yield patchVndAkeneoCollection(apiUrlChannels(), channels);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importChannels = importChannels;
function importCurrencies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importCurrencies';
        logger.info({ moduleName, methodName }, 'Starting...');
        logger.error({ moduleName, methodName }, 'Akeneo PIM does not support the import of currencies. ' +
            'Currencies are installed by: bin/console pim:installer:db.');
        return OK;
    });
}
exports.importCurrencies = importCurrencies;
function importFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameFamilies);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const families = JSON.parse(`[ ${buffer} ]`);
            // remove onboarder
            for (const family of families) {
                const attributes = [];
                for (const attribute of family.attributes || []) {
                    if (attribute === 'akeneo_onboarder_supplier') {
                        continue;
                    }
                    else {
                        attributes.push(attribute);
                    }
                }
                family.attributes = JSON.parse(JSON.stringify(attributes));
                for (const channel in family.attribute_requirements || {}) {
                    const attributes = [];
                    for (const attribute of family.attribute_requirements[channel]) {
                        if (attribute === 'akeneo_onboarder_supplier') {
                            continue;
                        }
                        else {
                            attributes.push(attribute);
                        }
                    }
                    family.attribute_requirements[channel] = JSON.parse(JSON.stringify(attributes));
                }
            }
            const results = yield patchVndAkeneoCollection(apiUrlFamilies(), families);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importFamilies = importFamilies;
function importFamilyVariants() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importFamilyVariants';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameFamilyVariants);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const familyVariants = JSON.parse(`[ ${buffer} ]`);
            for (const familyVariant of familyVariants) {
                for (const variantAttributeSet of familyVariant.variant_attribute_sets || []) {
                    const attributes = [];
                    for (const attribute of variantAttributeSet.attributes) {
                        if (attribute === 'akeneo_onboarder_supplier') {
                            continue;
                        }
                        else {
                            attributes.push(attribute);
                        }
                    }
                    variantAttributeSet.attributes = JSON.parse(JSON.stringify(attributes));
                }
            }
            familyVariants.sort((a, b) => {
                return a.family < b.family ? -1 :
                    a.family > b.family ? 1 :
                        a.code < b.code ? -1 :
                            a.code > b.code ? 1 : 0;
            });
            if (familyVariants.length > 0 &&
                familyVariants[0].family) {
                let familyCode = familyVariants[0].family || '';
                let familyCodeFamilyVariants = [];
                for (let i = 0; i < familyVariants.length; i++) {
                    if (familyCode !== familyVariants[i].family ||
                        (i + 1) === familyVariants.length) {
                        const results = yield patchVndAkeneoCollection(apiUrlFamilyVariants(familyCode), familyCodeFamilyVariants);
                        logger.debug({ moduleName, methodName, results });
                        familyCode = familyVariants[i].family || '';
                        familyCodeFamilyVariants = [];
                    }
                    const familyVariant = familyVariants[i];
                    delete familyVariant.family;
                    familyCodeFamilyVariants.push(familyVariant);
                }
                if (familyCodeFamilyVariants.length > 0) {
                    const results = yield patchVndAkeneoCollection(apiUrlFamilyVariants(familyCode), familyCodeFamilyVariants);
                    logger.debug({ moduleName, methodName, results });
                    if (results.responses &&
                        results.responses instanceof Array) {
                        for (const response of results.responses) {
                            let message = response.code ? `Code: ${response.code}: ` : '';
                            message += response.message ? `${response.message} ` : '';
                            if (response.errors &&
                                response.errors instanceof Array) {
                                for (const error of response.errors) {
                                    message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                                    message += error.message ? `${error.message} ` : '';
                                }
                            }
                            if (response.status_code > 299) {
                                logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                            }
                        }
                    }
                }
            }
        }
        return OK;
    });
}
exports.importFamilyVariants = importFamilyVariants;
function importLocales() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importCurrencies';
        logger.info({ moduleName, methodName }, 'Starting...');
        logger.error({ moduleName, methodName }, 'Akeneo PIM does not support the import of locales. ' +
            'Locales are installed by: bin/console pim:installer:db.');
        return OK;
    });
}
exports.importLocales = importLocales;
function importMeasureFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importMeasureFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameMeasureFamilies);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const measureFamilies = JSON.parse(`[ ${buffer} ]`);
            const results = yield patch(apiUrlMeasureFamilies(), measureFamilies);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importMeasureFamilies = importMeasureFamilies;
function importMeasurementFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importMeasurementFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameMeasurementFamilies);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const measurementFamilies = JSON.parse(`[ ${buffer} ]`);
            const results = yield patch(apiUrlMeasurementFamilies(), measurementFamilies);
            logger.debug({ moduleName, methodName, results });
            if (results.responses &&
                results.responses instanceof Array) {
                for (const response of results.responses) {
                    let message = response.code ? `Code: ${response.code}: ` : '';
                    message += response.message ? `${response.message} ` : '';
                    if (response.errors &&
                        response.errors instanceof Array) {
                        for (const error of response.errors) {
                            message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                            message += error.message ? `${error.message} ` : '';
                        }
                    }
                    if (response.status_code > 299) {
                        logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                    }
                }
            }
        }
        return OK;
    });
}
exports.importMeasurementFamilies = importMeasurementFamilies;
function importProducts() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importProducts';
        logger.info({ moduleName, methodName }, 'Starting...');
        const responses = [];
        const patchSize = exports.patchLimit * exports.promiseLimit;
        const mediaFilesMap = new Map();
        let stats = null;
        try {
            stats = yield stat(path.join(exports.exportPath, exports.filenameProductMediaFiles));
            yield load(path.join(exports.exportPath, exports.filenameProductMediaFiles), mediaFilesMap, 'fromHref');
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.info({ moduleName, methodName, error: inspect(err) }, `Error stating: ${path.join(exports.exportPath, exports.filenameProductMediaFiles)}`);
            }
        }
        const fileName = path.join(exports.exportPath, exports.filenameProducts);
        const productsMap = new Map();
        yield load(fileName, productsMap, 'identifier');
        let count = 0;
        let products = [];
        const limit = exports.promiseLimit;
        const productMediaFilesSet = new Set();
        const identifiers = Array.from(productsMap.keys()).sort();
        for (const identifier of identifiers) {
            const product = productsMap.get(identifier);
            const valueAttributes = product.values ? product.values : {};
            for (const valueAttribute in valueAttributes) {
                let found = 0;
                for (const valueObject of valueAttributes[valueAttribute]) {
                    if (valueObject.data &&
                        valueObject._links &&
                        valueObject._links.download &&
                        valueObject._links.download.href) {
                        ++found;
                        const attribute = valueAttribute;
                        const locale = valueObject.locale || null;
                        const scope = valueObject.scope || null;
                        const data = valueObject.data || '';
                        const href = valueObject._links.download.href || '';
                        // '{"identifier":"product_identifier", "attribute":"attribute_code", "scope":"channel_code","locale":"locale_code"}'
                        productMediaFilesSet.add({ identifier, attribute, scope, locale, data, href });
                    }
                }
                if (found) {
                    delete product.values[valueAttribute];
                }
            }
            if (product.associations &&
                process.env.AKENEO_SKIP_PRODUCT_ASSOCIATIONS_IMPORT) {
                delete product.associations;
            }
            if (product.groups) {
                delete product.groups;
            }
            if (product.values &&
                product.values.akeneo_onboarder_supplier) {
                delete product.values.akeneo_onboarder_supplier;
            }
            if (product.uuid) {
                delete product.uuid;
            }
            if (process.env.AKENEO_DELETE_MODELS &&
                product.parent) {
                product.parent = '';
            }
            products.push(product);
            if (products.length % patchSize === 0) {
                const productProducts = [];
                let i = 0;
                for (i = 0; i < limit; i++) {
                    productProducts[i] = [];
                }
                i = 0;
                for (const product of products) {
                    productProducts[i].push(product);
                    if (i < limit - 1) {
                        i++;
                    }
                    else {
                        i = 0;
                    }
                    ++count;
                }
                const promises = [];
                for (i = 0; i < limit; i++) {
                    promises[i] = patchVndAkeneoCollection(apiUrlProducts(), productProducts[i]);
                }
                const results = yield Promise.all(promises);
                for (const result of results) {
                    for (const response of result.responses) {
                        responses.push(response);
                    }
                }
                products = [];
                logger.info({ moduleName, methodName, count });
            }
        }
        if (products.length > 0) {
            const result = yield patchVndAkeneoCollection(apiUrlProducts(), products);
            for (const response of result.responses) {
                responses.push(response);
            }
        }
        for (const response of responses) {
            let message = response.identifier ? `Identifier: ${response.identifier}: ` : '';
            message += response.message ? `${response.message} ` : '';
            if (response.errors &&
                response.errors instanceof Array) {
                for (const error of response.errors) {
                    message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                    message += error.message ? `${error.message} ` : '';
                }
            }
            if (response.status_code > 299) {
                logger.error({ moduleName, methodName, identifier: response.identifier }, `Error: ${message}`);
            }
        }
        logger.info({ moduleName, methodName }, 'Importing linked images...');
        for (const productMediaFile of productMediaFilesSet.values()) {
            const mediaFile = mediaFilesMap.get(productMediaFile.href) || null;
            if (mediaFile) {
                if (!(mediaFile.toHref)) {
                    // upload and save the location
                    const pathAndFile = splitMediaFileData(productMediaFile.data);
                    const mediaFilePath = path.join(pathAndFile.path, pathAndFile.name);
                    delete productMediaFile.data;
                    delete productMediaFile.href;
                    const stream = fs.createReadStream(path.join(exports.exportPath, mediaFilePath));
                    if (stream) {
                        logger.info({ moduleName, methodName, mediaFilePath });
                        let uploadResults = null;
                        try {
                            uploadResults = yield postMultipartFormData(apiUrlProductMediaFiles(), stream, productMediaFile);
                            logger.info({ moduleName, methodName, code: productMediaFile.code, uploadResults: inspect(uploadResults) });
                            const location = uploadResults;
                            mediaFile.toHref = location;
                            mediaFile.toData = location.slice(location.indexOf(apiUrlProductMediaFiles()) + apiUrlProductMediaFiles().length, location.length);
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: inspect(err) }, `Error uploading ${mediaFilePath}`);
                        }
                    }
                }
                else {
                    // re-use the previously uploaded location
                    let patchResults = null;
                    try {
                        const patch = {};
                        patch.identifier = productMediaFile.identifier;
                        patch.values = {};
                        patch.values[productMediaFile.attribute] =
                            [{
                                    locale: productMediaFile.locale,
                                    scope: productMediaFile.scope,
                                    data: mediaFile.toData
                                }];
                        patchResults = yield patchVndAkeneoCollection(apiUrlProducts(), [patch]);
                        logger.debug({ moduleName, methodName, code: patch.code, patchResults: inspect(patchResults) });
                        for (const response of patchResults.responses) {
                            let message = response.identifier ? `Identifier: ${response.identifier}: ` : '';
                            message += response.message ? `${response.message} ` : '';
                            if (response.errors &&
                                response.errors instanceof Array) {
                                for (const error of response.errors) {
                                    message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                                    message += error.message ? `${error.message} ` : '';
                                }
                            }
                            if (response.status_code > 299) {
                                logger.error({ moduleName, methodName, identifier: response.identifier }, `Error: ${message}`);
                            }
                        }
                    }
                    catch (err) {
                        logger.error({ moduleName, methodName, error: inspect(err) }, `Error patching ${mediaFile}`);
                    }
                }
            }
        }
        const mediaFileDesc = yield open(path.join(exports.exportPath, exports.filenameProductMediaFiles), 'w');
        for (const mediaFile of mediaFilesMap.values()) {
            yield write(mediaFileDesc, `${JSON.stringify(mediaFile)}\n`);
        }
        yield close(mediaFileDesc);
        return count;
    });
}
exports.importProducts = importProducts;
function importProductModels() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importProductModels';
        logger.info({ moduleName, methodName }, 'Starting...');
        const responses = [];
        const mediaFilesMap = new Map();
        let stats = null;
        try {
            stats = yield stat(path.join(exports.exportPath, exports.filenameProductMediaFiles));
            yield load(path.join(exports.exportPath, exports.filenameProductMediaFiles), mediaFilesMap, 'fromHref');
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.info({ moduleName, methodName, error: inspect(err) }, `Error stating: ${path.join(exports.exportPath, exports.filenameProductMediaFiles)}`);
            }
        }
        const fileName = path.join(exports.exportPath, exports.filenameProductModels);
        const productModelsMap = new Map();
        yield load(fileName, productModelsMap, 'code');
        let count = 0;
        let productModels = [];
        const limit = exports.promiseLimit;
        const productModelMediaFilesSet = new Set();
        // sort for precedence
        const parentsMap = new Map();
        for (const productModel of productModelsMap.values()) {
            const parent = productModel.parent || '';
            const code = productModel.code || '';
            if (!(parentsMap.get(parent))) {
                const codes = new Set();
                codes.add(code);
                parentsMap.set(parent, codes);
            }
            else {
                const codes = parentsMap.get(parent) || new Set();
                codes.add(code);
            }
        }
        //console.log(inspect(parentsMap));
        const keys = [];
        function walk(parent, depth) {
            //console.log(`${parent}, ${depth}`);
            const codes = parentsMap.get(parent) || new Set();
            const level = depth + 1;
            if (codes.size > 0) {
                for (const code of codes.values()) {
                    keys.push({ code, level });
                    walk(code, level);
                }
            }
        }
        walk('', -1);
        keys.sort((a, b) => {
            return a.level < b.level ? -1 :
                a.level > b.level ? 1 : 0;
        });
        //console.log(inspect(keys));
        //if (methodName !== 'junk') process.exit();
        for (const key of keys) {
            const productModel = productModelsMap.get(key.code);
            const code = productModel.code ? productModel.code : '';
            const valueAttributes = productModel.values ? productModel.values : {};
            for (const valueAttribute in valueAttributes) {
                let found = 0;
                for (const valueObject of valueAttributes[valueAttribute]) {
                    if (valueObject.data &&
                        valueObject._links &&
                        valueObject._links.download &&
                        valueObject._links.download.href) {
                        ++found;
                        const attribute = valueAttribute;
                        const locale = valueObject.locale || null;
                        const scope = valueObject.scope || null;
                        const data = valueObject.data || '';
                        const href = valueObject._links.download.href || '';
                        // '{"code":"product_model_code", "attribute":"attribute_code", "scope":"channel_code","locale":"locale_code"}'
                        productModelMediaFilesSet.add({ code, attribute, scope, locale, data, href });
                    }
                }
                if (found) {
                    delete productModel.values[valueAttribute];
                }
            }
            if (productModel.values &&
                productModel.values.akeneo_onboarder_supplier) {
                delete productModel.values.akeneo_onboarder_supplier;
            }
            if (productModel.values &&
                productModel.values.salesOrgStatusTable) {
                delete productModel.values.salesOrgStatusTable;
            }
            productModels.push(productModel);
            if (productModels.length % 1600 === 0) {
                const productModelProductModels = [];
                let i = 0;
                for (i = 0; i < limit; i++) {
                    productModelProductModels[i] = [];
                }
                i = 0;
                for (const productModel of productModels) {
                    productModelProductModels[i].push(productModel);
                    if (i < limit - 1) {
                        i++;
                    }
                    else {
                        i = 0;
                    }
                    ++count;
                }
                const promises = [];
                for (i = 0; i < limit; i++) {
                    promises[i] = patchVndAkeneoCollection(apiUrlProductModels(), productModelProductModels[i]);
                }
                const results = yield Promise.all(promises);
                for (const result of results) {
                    for (const response of result.responses) {
                        responses.push(response);
                    }
                }
                productModels = [];
                logger.info({ moduleName, methodName, count });
            }
        }
        if (productModels.length > 0) {
            const result = yield patchVndAkeneoCollection(apiUrlProductModels(), productModels);
            for (const response of result.responses) {
                responses.push(response);
            }
        }
        for (const response of responses) {
            let message = response.code ? `Code: ${response.code}: ` : '';
            message += response.message ? `${response.message} ` : '';
            if (response.errors &&
                response.errors instanceof Array) {
                for (const error of response.errors) {
                    message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                    message += error.message ? `${error.message} ` : '';
                }
            }
            if (response.status_code > 299) {
                logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
            }
        }
        logger.info({ moduleName, methodName }, 'Importing linked images...');
        for (const productModelMediaFile of productModelMediaFilesSet.values()) {
            const mediaFile = mediaFilesMap.get(productModelMediaFile.href) || null;
            if (mediaFile) {
                if (!(mediaFile.toHref)) {
                    // upload and save the location
                    const pathAndFile = splitMediaFileData(productModelMediaFile.data);
                    const mediaFilePath = path.join(pathAndFile.path, pathAndFile.name);
                    delete productModelMediaFile.data;
                    delete productModelMediaFile.href;
                    const stream = fs.createReadStream(path.join(exports.exportPath, mediaFilePath));
                    if (stream) {
                        logger.info({ moduleName, methodName, mediaFilePath });
                        let uploadResults = null;
                        try {
                            uploadResults = yield postMultipartFormData(apiUrlProductMediaFiles(), stream, productModelMediaFile);
                            logger.info({ moduleName, methodName, code: productModelMediaFile.code, uploadResults: inspect(uploadResults) });
                            const location = uploadResults;
                            mediaFile.toHref = location;
                            mediaFile.toData = location.slice(location.indexOf(apiUrlProductMediaFiles()) + apiUrlProductMediaFiles().length, location.length);
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: inspect(err) }, `Error uploading ${mediaFilePath}`);
                        }
                    }
                }
                else {
                    // re-use the previously uploaded location
                    let patchResults = null;
                    try {
                        const patch = {};
                        patch.code = productModelMediaFile.code;
                        patch.values = {};
                        patch.values[productModelMediaFile.attribute] =
                            [{
                                    locale: productModelMediaFile.locale,
                                    scope: productModelMediaFile.scope,
                                    data: mediaFile.toData
                                }];
                        patchResults = yield patchVndAkeneoCollection(apiUrlProductModels(), [patch]);
                        logger.debug({ moduleName, methodName, code: patch.code, patchResults: inspect(patchResults) });
                        for (const response of patchResults.responses) {
                            let message = response.code ? `Code: ${response.code}: ` : '';
                            message += response.message ? `${response.message} ` : '';
                            if (response.errors &&
                                response.errors instanceof Array) {
                                for (const error of response.errors) {
                                    message += error.attribute ? `For attribute ${error.attribute}: ` : '';
                                    message += error.message ? `${error.message} ` : '';
                                }
                            }
                            if (response.status_code > 299) {
                                logger.error({ moduleName, methodName, code: response.code }, `Error: ${message}`);
                            }
                        }
                    }
                    catch (err) {
                        logger.error({ moduleName, methodName, error: inspect(err) }, `Error patching ${mediaFile}`);
                    }
                }
            }
        }
        const mediaFileDesc = yield open(path.join(exports.exportPath, exports.filenameProductMediaFiles), 'w');
        for (const mediaFile of mediaFilesMap.values()) {
            yield write(mediaFileDesc, `${JSON.stringify(mediaFile)}\n`);
        }
        yield close(mediaFileDesc);
        return count;
    });
}
exports.importProductModels = importProductModels;
/******************** R E F E R E N C E   E N T I T I E S ********************/
function importReferenceEntities() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importReferenceEntities';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameReferenceEntities);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const referenceEntities = JSON.parse(`[ ${buffer} ]`);
            for (const referenceEntity of referenceEntities) {
                const results = yield patch(`${apiUrlReferenceEntities(referenceEntity.code)}`, referenceEntity);
                // logger.info({ moduleName, methodName, results });
            }
        }
        return OK;
    });
}
exports.importReferenceEntities = importReferenceEntities;
function importReferenceEntityAttributes() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importReferenceEntityAttributes';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameReferenceEntityAttributes);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const referenceEntityAttributes = JSON.parse(`[ ${buffer} ]`);
            for (const referenceEntityAttribute of referenceEntityAttributes) {
                const referenceEntityCode = referenceEntityAttribute.delete_reference_entity_code || '';
                delete referenceEntityAttribute.delete_reference_entity_code;
                delete referenceEntityAttribute._links;
                let inCount = 0;
                for (const label in referenceEntityAttribute.labels) {
                    ++inCount;
                }
                if (!(inCount)) {
                    referenceEntityAttribute.labels['en_US'] = `[${referenceEntityAttribute.code}]`;
                }
                const results = yield patch(`${apiUrlReferenceEntityAttributes(referenceEntityCode)}/${referenceEntityAttribute.code}`, referenceEntityAttribute);
                // logger.info({ moduleName, methodName, results });
            }
        }
        return OK;
    });
}
exports.importReferenceEntityAttributes = importReferenceEntityAttributes;
function importReferenceEntityAttributeOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importReferenceEntityAttributeOptions';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameReferenceEntityAttributeOptions);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const referenceEntityAttributeOptions = JSON.parse(`[ ${buffer} ]`);
            for (const referenceEntityAttributeOption of referenceEntityAttributeOptions) {
                const referenceEntityCode = referenceEntityAttributeOption.delete_reference_entity_code || '';
                const attributeCode = referenceEntityAttributeOption.delete_attribute_code || '';
                delete referenceEntityAttributeOption.delete_reference_entity_code;
                delete referenceEntityAttributeOption.delete_attribute_code;
                const results = yield patch(`${apiUrlReferenceEntityAttributeOptions(referenceEntityCode, attributeCode)}` +
                    `/${referenceEntityAttributeOption.code}`, referenceEntityAttributeOption);
                // logger.info({ moduleName, methodName, results });
            }
        }
        return OK;
    });
}
exports.importReferenceEntityAttributeOptions = importReferenceEntityAttributeOptions;
function importReferenceEntityRecords() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importReferenceEntityRecords';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameReferenceEntityRecords);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const referenceEntityRecords = JSON.parse(`[ ${buffer} ]`);
            if (referenceEntityRecords.length > 0) {
                let referenceEntityData = [];
                let referenceEntityCode = referenceEntityRecords[0].delete_reference_entity_code || '';
                let count = 0;
                for (let i = 0; i < referenceEntityRecords.length; i++) {
                    if (referenceEntityCode !== referenceEntityRecords[i].delete_reference_entity_code ||
                        (count > 0 && count % exports.patchLimit === 0) ||
                        (i + 1) === referenceEntityRecords.length) {
                        const results = yield patch(`${apiUrlReferenceEntityRecords(referenceEntityCode)}`, referenceEntityData);
                        // logger.info({ moduleName, methodName, results });
                        referenceEntityCode = referenceEntityRecords[i].delete_reference_entity_code || '';
                        referenceEntityData = [];
                        count = 0;
                    }
                    //
                    if (referenceEntityRecords[i].values &&
                        referenceEntityRecords[i].values.image &&
                        referenceEntityRecords[i].values.image[0] &&
                        process.env.AKENEO_SKIP_REFERENCE_ENTITY_IMAGE_IMPORT) {
                        delete referenceEntityRecords[i].values.image;
                    }
                    //
                    delete referenceEntityRecords[i].created;
                    delete referenceEntityRecords[i].updated;
                    delete referenceEntityRecords[i].delete_reference_entity_code;
                    delete referenceEntityRecords[i]._links;
                    referenceEntityData.push(referenceEntityRecords[i]);
                    count++;
                }
            }
        }
        return OK;
    });
}
exports.importReferenceEntityRecords = importReferenceEntityRecords;
function importReferenceEntityMediaFiles(referenceEntityCode, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importReferenceEntityMediaFiles';
        logger.info({ moduleName, methodName }, `Starting...`);
        const dirs = exports.exportPath.split(path.sep);
        dirs.push(referenceEntityCode);
        let dirPath = '';
        for (const dir of dirs) {
            if (dir !== '.') {
                dirPath += path.sep;
                dirPath += dir;
                try {
                    fs.mkdirSync(dirPath);
                }
                catch (err) {
                    if (err.code !== 'EEXIST') {
                        throw err;
                    }
                }
            }
            else {
                dirPath += dir;
            }
        }
        const results = {};
        let referenceEntityMediaFileCode = '';
        for (const datum of data) {
            const code = datum.code;
            try {
                const stream = fs.createReadStream(`${dirPath}${path.sep}${code}.png`);
                referenceEntityMediaFileCode = yield postMultipartFormData(apiUrlReferenceEntityMediaFiles(), stream);
                const result = {
                    referenceEntityCode,
                    referenceEntityMediaFileCode
                };
                results[code] = result;
            }
            catch (err) {
                logger.error({ moduleName, methodName, err }, `loading ${code}.png`);
                process.exit(99);
            }
        }
        const handle = yield open(`${dirPath}${path.sep}referenceEntityMediaFilesMap.txt`, 'a');
        for (const result of results) {
            yield write(handle, `${JSON.stringify(result).toString()}\n`);
        }
        yield close(handle);
        return results;
    });
}
exports.importReferenceEntityMediaFiles = importReferenceEntityMediaFiles;
/******************** A S S E T   F A M I L I E S ********************/
function importAssetFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAssetFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAssetFamilies);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const assetFamilies = JSON.parse(`[ ${buffer} ]`);
            for (const assetFamily of assetFamilies) {
                delete assetFamily.attribute_as_main_media;
                const results = yield patch(`${apiUrlAssetFamilies()}/${assetFamily.code}`, assetFamily);
                // logger.info({ moduleName, methodName, results });
            }
        }
        return OK;
    });
}
exports.importAssetFamilies = importAssetFamilies;
function importAssetFamilyAttributes() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAssetFamilyAttributes';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAssetFamilyAttributes);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const assetFamilyAttributes = JSON.parse(`[ ${buffer} ]`);
            for (const assetFamilyAttribute of assetFamilyAttributes) {
                const assetFamilyCode = assetFamilyAttribute.delete_asset_family_code || '';
                delete assetFamilyAttribute.delete_asset_family_code;
                delete assetFamilyAttribute._links;
                const results = yield patch(`${apiUrlAssetFamilyAttributes(assetFamilyCode)}/${assetFamilyAttribute.code}`, assetFamilyAttribute);
                // logger.info({ moduleName, methodName, results });
            }
        }
        return OK;
    });
}
exports.importAssetFamilyAttributes = importAssetFamilyAttributes;
function importAssetFamilyAttributeOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAssetFamilyAttributeOptions';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAssetFamilyAttributeOptions);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const assetFamilyAttributeOptions = JSON.parse(`[ ${buffer} ]`);
            for (const assetFamilyAttributeOption of assetFamilyAttributeOptions) {
                const assetFamilyCode = assetFamilyAttributeOption.delete_asset_family_code || '';
                const attributeCode = assetFamilyAttributeOption.delete_attribute_code || '';
                delete assetFamilyAttributeOption.delete_asset_family_code;
                delete assetFamilyAttributeOption.delete_attribute_code;
                const results = yield patch(`${apiUrlAssetFamilyAttributeOptions(assetFamilyCode, attributeCode)}` +
                    `/${assetFamilyAttributeOption.code}`, assetFamilyAttributeOption);
                // logger.info({ moduleName, methodName, results });
            }
        }
        return OK;
    });
}
exports.importAssetFamilyAttributeOptions = importAssetFamilyAttributeOptions;
function importAssetFamilyAssets() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAssetFamilyAssets';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exports.exportPath, exports.filenameAssetFamilyAssets);
        const fileDesc = yield open(fileName, 'r');
        const buffer = (yield read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield close(fileDesc);
        if (buffer.length > 0) {
            const assetFamilyAssets = JSON.parse(`[ ${buffer} ]`);
            if (assetFamilyAssets.length > 0) {
                let assetFamilyData = [];
                let assetFamilyCode = assetFamilyAssets[0].delete_asset_family_code || '';
                let count = 0;
                for (let i = 0; i < assetFamilyAssets.length; i++) {
                    if (assetFamilyCode !== assetFamilyAssets[i].delete_asset_family_code ||
                        (count > 0 && count % exports.patchLimit === 0) ||
                        (i + 1) === assetFamilyAssets.length) {
                        const results = yield patch(`${apiUrlAssetFamilyAssets(assetFamilyCode)}`, assetFamilyData);
                        // logger.info({ moduleName, methodName, results });
                        assetFamilyCode = assetFamilyAssets[i].delete_asset_family_code || '';
                        assetFamilyData = [];
                        count = 0;
                    }
                    if (assetFamilyAssets[i].values &&
                        assetFamilyAssets[i].values.image &&
                        assetFamilyAssets[i].values.image[0] &&
                        process.env.AKENEO_SKIP_ASSET_IMAGE_IMPORT) {
                        delete assetFamilyAssets[i].values.image;
                    }
                    //
                    delete assetFamilyAssets[i].created;
                    delete assetFamilyAssets[i].updated;
                    delete assetFamilyAssets[i]._links;
                    delete assetFamilyAssets[i].delete_asset_family_code;
                    assetFamilyData.push(assetFamilyAssets[i]);
                    count++;
                }
            }
        }
        return OK;
    });
}
exports.importAssetFamilyAssets = importAssetFamilyAssets;
function importAssetFamilyMediaFiles(assetFamilyCode, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAssetFamilyMediaFiles';
        logger.info({ moduleName, methodName }, `Starting...`);
        const dirs = exports.exportPath.split(path.sep);
        dirs.push(assetFamilyCode);
        let dirPath = '';
        for (const dir of dirs) {
            if (dir !== '.') {
                dirPath += path.sep;
                dirPath += dir;
                try {
                    fs.mkdirSync(dirPath);
                }
                catch (err) {
                    if (err.code !== 'EEXIST') {
                        throw err;
                    }
                }
            }
            else {
                dirPath += dir;
            }
        }
        const results = {};
        let assetFamiliesMediaFileCode = '';
        for (const datum of data) {
            const code = datum.code;
            try {
                const stream = fs.createReadStream(`${dirPath}${path.sep}${code}.png`);
                assetFamiliesMediaFileCode = yield postMultipartFormData(apiUrlReferenceEntityMediaFiles(), stream);
                const result = {
                    assetFamilyCode,
                    assetFamiliesMediaFileCode
                };
                results[code] = result;
            }
            catch (err) {
                logger.error({ moduleName, methodName, err }, `loading ${code}.png`);
                process.exit(99);
            }
        }
        const handle = yield open(`${dirPath}${path.sep}assetFamilyMediaFilesMap.txt`, 'a');
        for (const result of results) {
            yield write(handle, `${JSON.stringify(result).toString()}\n`);
        }
        yield close(handle);
        return results;
    });
}
exports.importAssetFamilyMediaFiles = importAssetFamilyMediaFiles;
// TODO: PAM imports
// export async function importAssets(): Promise<any> {
// export async function importAssetCategories(): Promise<any> {
// export async function importAssetReferenceFiles(): Promise<any> {
// export async function importAssetTags(): Promise<any> {
// export async function importAssetVariationFiles(): Promise<any> {
// A main method with no command line parameter management
function main(...args) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'main';
        const loggerLevel = process.env.LOG_LEVEL || 'info';
        logger.level(loggerLevel);
        const started = new Date();
        logger.info({ moduleName, methodName, started }, ` Starting...`);
        const cla = argz(args);
        const tasks = cla.tasks;
        let results = [];
        results = (tasks.importAssociationTypes) ? yield importAssociationTypes() : [];
        results = (tasks.importAttributes) ? yield importAttributes() : [];
        results = (tasks.importAttributeGroups) ? yield importAttributeGroups() : [];
        results = (tasks.importAttributeOptions) ? yield importAttributeOptions() : [];
        results = (tasks.importCategories) ? yield importCategories() : [];
        results = (tasks.importChannels) ? yield importChannels() : [];
        // results = (tasks.importCurrencies) ? await importCurrencies() : []; // Not Supported by API
        results = (tasks.importFamilies) ? yield importFamilies() : [];
        results = (tasks.importFamilyVariants) ? yield importFamilyVariants() : [];
        //  results = (tasks.importGroups) ? await importGroups() : [];
        // results = (tasks.importLocales) ? await importLocales() : []; // Not Supported by API
        results = (tasks.importMeasureFamilies) ? yield importMeasureFamilies() : [];
        results = (tasks.importMeasurementFamilies) ? yield importMeasurementFamilies() : [];
        results = (tasks.importProducts) ? yield importProducts() : [];
        results = (tasks.importProductModels) ? yield importProductModels() : [];
        results = (tasks.importReferenceEntities) ? yield importReferenceEntities() : [];
        results = (tasks.importReferenceEntityAttributes) ? yield importReferenceEntityAttributes() : [];
        results = (tasks.importReferenceEntityAttributeOptions) ? yield importReferenceEntityAttributeOptions() : [];
        results = (tasks.importReferenceEntityRecords) ? yield importReferenceEntityRecords() : [];
        results = (tasks.importAssetFamilies) ? yield importAssetFamilies() : [];
        results = (tasks.importAssetFamilyAttributes) ? yield importAssetFamilyAttributes() : [];
        results = (tasks.importAssetFamilyAttributeOptions) ? yield importAssetFamilyAttributeOptions() : [];
        results = (tasks.importAssetFamilyAssets) ? yield importAssetFamilyAssets() : [];
        // TODO: results = (tasks.importAssets) ? await importAssets() : [];
        // TODO: results = (tasks.importAssetCategories) ? await importAssetCategories() : [];
        // TODO: results = (tasks.importAssetReferenceFiles) ? await importAssetReferenceFiles() : [];
        // TODO: results = (tasks.importAssetTags) ? await importAssetTags() : [];
        // TODO: results = (tasks.importAssetVariationFiles) ? await importAssetVariationFiles() : [];
        results = (tasks.exportAssociationTypes) ? yield exportAssociationTypes() : [];
        results = (tasks.exportAttributes) ? yield exportAttributes() : [];
        results = (tasks.exportAttributeGroups) ? yield exportAttributeGroups() : [];
        results = (tasks.exportAttributeOptions) ? yield exportAttributeOptions(cla.parameter) : [];
        results = (tasks.exportCategories) ? yield exportCategories() : [];
        results = (tasks.exportChannels) ? yield exportChannels() : [];
        results = (tasks.exportCurrencies) ? yield exportCurrencies() : [];
        results = (tasks.exportFamilies) ? yield exportFamilies() : [];
        results = (tasks.exportFamilyVariants) ? yield exportFamilyVariants(cla.parameter) : [];
        results = (tasks.exportGroups) ? yield exportGroups() : [];
        results = (tasks.exportLocales) ? yield exportLocales() : [];
        results = (tasks.exportMeasureFamilies) ? yield exportMeasureFamilies() : [];
        results = (tasks.exportMeasurementFamilies) ? yield exportMeasurementFamilies() : [];
        results = (tasks.exportProducts) ? yield exportProducts(cla.parameter) : [];
        results = (tasks.exportProductModels) ? yield exportProductModels() : [];
        // TODO: results = (tasks.exportPublishedProduct) ? await exportPublishedProduct() : [];
        // TODO: results = (tasks.exportProductMediaFile) ? await exportProductMediaFile() : [];
        results = (tasks.exportReferenceEntities) ? yield exportReferenceEntities() : [];
        results = (tasks.exportReferenceEntityAttributes) ? yield exportReferenceEntityAttributes(cla.parameter) : [];
        // this requires more than one parameter
        // results = (tasks.exportReferenceEntityAttributeOptions) ? await exportReferenceEntityAttributeOptions(cla.parameter) : [];
        results = (tasks.exportReferenceEntityRecords) ? yield exportReferenceEntityRecords(cla.parameter) : [];
        // TODO: results = (tasks.exportReferenceEntityMediaFile) ? await exportReferenceEntityMediaFile() : [];
        results = (tasks.exportAssets) ? yield exportAssets() : [];
        results = (tasks.exportAssetCategories) ? yield exportAssetCategories() : [];
        results = (tasks.exportProductMediaFiles) ? yield exportProductMediaFiles() : [];
        // TODO: results = (tasks.exportAssetReferenceFiles) ? await exportAssetReferenceFiles() : [];
        results = (tasks.exportAssetTags) ? yield exportAssetTags() : [];
        // TODO: results = (tasks.exportAssetVariationFiles) ? await exportAssetVariationFiles() : [];
        results = (tasks.exportAssetFamilies) ? yield exportAssetFamilies() : [];
        const stopped = new Date();
        const duration = ((stopped.getTime() - started.getTime()) / 1000).toLocaleString('en-US');
        const heapUsed = process.memoryUsage().heapUsed.toLocaleString('en-US');
        logger.info({ moduleName, methodName, heapUsed, started, stopped, duration }, `in seconds`);
    });
}
// Start the program
if (require.main === module) {
    main();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsK0NBQStDOzs7Ozs7Ozs7O0FBRS9DLDhCQUE4QjtBQUM5QixnQ0FBZ0M7QUFDaEMsaUNBQWlDO0FBQ2pDLHNDQUFzQztBQUN0QyxzQ0FBc0M7QUFDdEMseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyw2QkFBNkI7QUFDN0IsNkJBQTZCO0FBZ0M3QixNQUFNLFVBQVUsR0FBVyxRQUFRLENBQUM7QUFFcEMsSUFBSSxNQUFNLEdBQVcsTUFBTSxDQUFDLFlBQVksQ0FBQyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQy9ELG1CQUEwQixRQUFnQjtJQUN4QyxNQUFNLEdBQUcsUUFBUSxDQUFDO0FBQ3BCLENBQUM7QUFGRCw4QkFFQztBQUVELE1BQU0sYUFBYSxHQUFhO0lBQzlCLHVCQUF1QjtJQUN2QixxQkFBcUI7SUFDckIsY0FBYztJQUNkLGlCQUFpQjtJQUNqQix3QkFBd0I7SUFDeEIsdUJBQXVCO0lBQ3ZCLGtCQUFrQjtJQUNsQixrQkFBa0I7SUFDbEIsZ0JBQWdCO0lBQ2hCLGtCQUFrQjtJQUNsQixnQkFBZ0I7SUFDaEIsc0JBQXNCO0lBQ3RCLGNBQWM7SUFDZCxlQUFlO0lBQ2YsdUJBQXVCO0lBQ3ZCLDJCQUEyQjtJQUMzQix5QkFBeUI7SUFDekIscUJBQXFCO0lBQ3JCLGdCQUFnQjtJQUNoQix5QkFBeUI7SUFDekIsbUJBQW1CO0lBQ25CLHFCQUFxQjtJQUNyQix5QkFBeUI7SUFDekIsbUNBQW1DO0lBQ25DLDZCQUE2QjtJQUM3Qix3QkFBd0I7SUFDeEIsdUJBQXVCO0lBQ3ZCLHdCQUF3QjtJQUN4QixrQkFBa0I7SUFDbEIsa0JBQWtCO0lBQ2xCLGdCQUFnQjtJQUNoQixnQkFBZ0I7SUFDaEIsc0JBQXNCO0lBQ3RCLHVCQUF1QjtJQUN2QiwyQkFBMkI7SUFDM0IscUJBQXFCO0lBQ3JCLGdCQUFnQjtJ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