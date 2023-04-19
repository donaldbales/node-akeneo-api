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
exports.patchLimit = Number.parseInt(process.env.AKENEO_PATCH_LIMIT || '100', 10);
exports.promiseLimit = Number.parseInt(process.env.AKENEO_PROMISE_LIMIT || '16', 10);
let clientId = process.env.AKENEO_CLIENT_ID || '';
let password = process.env.AKENEO_PASSWORD || '';
let secret = process.env.AKENEO_SECRET || '';
let tokenUrl = process.env.AKENEO_TOKEN_URL || '/api/oauth/v1/token';
let username = process.env.AKENEO_USERNAME || '';
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
let protocol = exports.baseUrl.slice(0, 5) === 'https' ? _https : _http;
let agent = new protocol.Agent({
    keepAlive: true,
    keepAliveMsecs: 300000,
    maxSockets: Infinity
});
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
                    'Content-Type': 'application/octet-stream'
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
            const result = yield new Promise((resolve, reject) => {
                let buffer = Buffer.from('');
                const options = {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    method: 'GET'
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
            if (result &&
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