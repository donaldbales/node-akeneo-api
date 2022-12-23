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
    'exportLocales',
    'exportMeasureFamilies',
    'exportProductMediaFiles',
    'exportProductModels',
    'exportProducts',
    'exportReferenceEntities',
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
    // console.error(tasks);
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
                const error = err.message ? err.message : err;
                logger.error({ moduleName, methodName, error }, `Error!`);
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
                        const keyValue = doc[key];
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
                        map.set(doc[key], doc);
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
let clientId = process.env.AKENEO_CLIENT_ID || '';
exports.exportPath = process.env.AKENEO_EXPORT_PATH || '.';
let password = process.env.AKENEO_PASSWORD || '';
let patchLimit = Number.parseInt(process.env.AKENEO_PATCH_LIMIT || '100', 10);
let promiseLimit = Number.parseInt(process.env.AKENEO_PROMISE_LIMIT || '16', 10);
let secret = process.env.AKENEO_SECRET || '';
let tokenUrl = process.env.AKENEO_TOKEN_URL || '/api/oauth/v1/token';
let username = process.env.AKENEO_USERNAME || '';
function baseProtocol() {
    return exports.baseUrl.slice(0, exports.baseUrl.indexOf(':'));
}
exports.baseProtocol = baseProtocol;
function setBaseUrl(value) {
    exports.baseUrl = value;
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
exports.filenameLocales = 'locales.vac';
exports.filenameMeasureFamilies = 'measureFamilies.vac';
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
        console.error(`WARNING: asset code truncated to 255 characters: ${code.toString()}.`);
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
        console.error(`WARNING: attribute code truncated to 100 characters: ${code.toString()}.`);
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
        console.error(`WARNING: label truncated to 255 characters: ${label}.`);
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
        console.error(`WARNING: file code truncated to 250 characters: ${code.toString()}.`);
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
        console.error(`WARNING: reference entity code truncated to 255 characters: ${code.toString()}.`);
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
        console.error(`WARNING: url code truncated to 255 characters: ${code.toString()}.`);
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
function apiUrlMeasurementFamilies() {
    return '/api/rest/v1/measurement-families';
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
const protocol = exports.baseUrl.slice(0, 5) === 'https' ? _https : _http;
const agent = new protocol.Agent({
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
        let url = apiUrl.indexOf('?') === -1 ? `${exports.baseUrl}${apiUrl}?limit=${patchLimit}` : `${exports.baseUrl}${apiUrl}&limit=${patchLimit}`;
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
                console.error(inspect(result));
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
            if ((1 + i) % patchLimit === 0 ||
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
                                try {
                                    results.responses = JSON.parse(`[ ${buffer.toString().replace(/\n/g, ',')} ]`);
                                    for (const response of results.responses) {
                                        if (response.line !== undefined &&
                                            response.message !== undefined) {
                                            response.data = dataArray[response.line - 1];
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
                        const object = response;
                        for (const property in object) {
                            if (object.hasOwnProperty(property)) {
                                const value = object[property];
                                logger.error({ moduleName, methodName, apiUrl: apiUrl, property, value });
                            }
                        }
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
        let stats = null;
        try {
            stats = yield stat(path.join(exports.exportPath, exports.filenameProductMediaFiles));
            yield load(path.join(exports.exportPath, exports.filenameProductMediaFiles), productMediaFilesMap, 'fromHref');
        }
        catch (err) {
            console.error(inspect(err));
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
        let stats = null;
        try {
            stats = yield stat(path.join(exports.exportPath, exports.filenameProductMediaFiles));
            yield load(path.join(exports.exportPath, exports.filenameProductMediaFiles), productMediaFilesMap, 'fromHref');
        }
        catch (err) {
            console.error(inspect(err));
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
            logger.info({ moduleName, methodName, results });
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
            logger.info({ moduleName, methodName, results });
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
            logger.info({ moduleName, methodName, results });
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
                        logger.info({ moduleName, methodName, results });
                        attributeCode = attributeOptions[i].attribute || '';
                        attributeCodeAttributeOptions = [];
                    }
                    const attributeOption = attributeOptions[i];
                    attributeCodeAttributeOptions.push(attributeOption);
                }
                if (attributeCodeAttributeOptions.length > 0) {
                    const results = yield patchVndAkeneoCollection(apiUrlAttributeOptions(attributeCode), attributeCodeAttributeOptions);
                    logger.info({ moduleName, methodName, results });
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
            logger.info({ moduleName, methodName, results });
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
            logger.info({ moduleName, methodName, results });
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
            const results = yield patchVndAkeneoCollection(apiUrlFamilies(), families);
            logger.info({ moduleName, methodName, results });
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
                        logger.info({ moduleName, methodName, results });
                        familyCode = familyVariants[i].family || '';
                        familyCodeFamilyVariants = [];
                    }
                    const familyVariant = familyVariants[i];
                    delete familyVariant.family;
                    familyCodeFamilyVariants.push(familyVariant);
                }
                if (familyCodeFamilyVariants.length > 0) {
                    const results = yield patchVndAkeneoCollection(apiUrlFamilyVariants(familyCode), familyCodeFamilyVariants);
                    logger.info({ moduleName, methodName, results });
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
        const methodName = 'importCurrencies';
        logger.info({ moduleName, methodName }, 'Starting...');
        logger.error({ moduleName, methodName }, 'Akeneo PIM does not support the import of measure families. ' +
            'Measure Families are installed by: bin/console pim:installer:db.');
        return OK;
    });
}
exports.importMeasureFamilies = importMeasureFamilies;
function importProducts() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importProducts';
        logger.info({ moduleName, methodName }, 'Starting...');
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
        const productMediaFilesSet = new Set();
        const fileName = path.join(exports.exportPath, exports.filenameProducts);
        const productsMap = new Map();
        yield load(fileName, productsMap, 'identifier');
        const identifiers = Array.from(productsMap.keys()).sort();
        const limit = promiseLimit;
        let count = 0;
        let products = [];
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
            if (product) {
                if (process.env.AKENEO_DELETE_MODELS &&
                    product.parent) {
                    product.parent = '';
                }
                products.push(product);
                if (products.length % 1600 === 0) {
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
                    products = [];
                    logger.info({ moduleName, methodName, count });
                }
            }
        }
        if (products.length > 0) {
            const results = yield patchVndAkeneoCollection(apiUrlProducts(), products);
            logger.info({ moduleName, methodName, count });
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
                            const location = uploadResults;
                            mediaFile.toHref = location;
                            mediaFile.toData = location.slice(location.indexOf(apiUrlProductMediaFiles()) + apiUrlProductMediaFiles().length, location.length);
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: inspect(err) }, 'Error uploading ${mediaFilePath}');
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
                        patchResults = patchVndAkeneoCollection(apiUrlProducts(), patch);
                    }
                    catch (err) {
                        logger.error({ moduleName, methodName, error: inspect(err) }, 'Error patching ${mediaFilePath}');
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
        const limit = promiseLimit;
        const productModelMediaFilesSet = new Set();
        // sort for precedence
        const keys = [];
        for (const productModel of productModelsMap.values()) {
            const code = productModel.code || '';
            const parent = productModel.parent || '';
            keys.push({ parent, code });
        }
        keys.sort((a, b) => {
            return a.parent < b.parent ? -1 :
                a.parent > b.parent ? 1 :
                    a.code < b.code ? -1 :
                        a.code > b.code ? 1 : 0;
        });
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
            productModels.push(productModel);
            if (productModels.length % 1600 === 0) {
                const productModelproductModels = [];
                let i = 0;
                for (i = 0; i < limit; i++) {
                    productModelproductModels[i] = [];
                }
                i = 0;
                for (const productModel of productModels) {
                    productModelproductModels[i].push(productModel);
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
                    promises[i] = patchVndAkeneoCollection(apiUrlProductModels(), productModelproductModels[i]);
                }
                const results = yield Promise.all(promises);
                productModels = [];
                logger.info({ moduleName, methodName, count });
            }
        }
        if (productModels.length > 0) {
            const results = yield patchVndAkeneoCollection(apiUrlProductModels(), productModels);
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
                            const location = uploadResults;
                            mediaFile.toHref = location;
                            mediaFile.toData = location.slice(location.indexOf(apiUrlProductMediaFiles()) + apiUrlProductMediaFiles().length, location.length);
                        }
                        catch (err) {
                            logger.error({ moduleName, methodName, error: inspect(err) }, 'Error uploading ${mediaFilePath}');
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
                        patchResults = patchVndAkeneoCollection(apiUrlProductModels(), patch);
                    }
                    catch (err) {
                        logger.error({ moduleName, methodName, error: inspect(err) }, 'Error patching ${mediaFilePath}');
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
                        (count > 0 && count % patchLimit === 0) ||
                        (i + 1) === referenceEntityRecords.length) {
                        const results = yield patch(`${apiUrlReferenceEntityRecords(referenceEntityCode)}`, referenceEntityData);
                        // logger.info({ moduleName, methodName, results });
                        referenceEntityCode = referenceEntityRecords[i].delete_reference_entity_code || '';
                        referenceEntityData = [];
                        count = 0;
                    }
                    delete referenceEntityRecords[i].delete_reference_entity_code;
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
                        (count > 0 && count % patchLimit === 0) ||
                        (i + 1) === assetFamilyAssets.length) {
                        const results = yield patch(`${apiUrlAssetFamilyAssets(assetFamilyCode)}`, assetFamilyData);
                        // logger.info({ moduleName, methodName, results });
                        assetFamilyCode = assetFamilyAssets[i].delete_asset_family_code || '';
                        assetFamilyData = [];
                        count = 0;
                    }
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
        // results = (tasks.importLocales) ? await importLocales() : []; // Not Supported by API
        // results = (tasks.importMeasureFamilies) ? await importMeasureFamilies() : []; // Not Supported by API
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
        results = (tasks.exportLocales) ? yield exportLocales() : [];
        results = (tasks.exportMeasureFamilies) ? yield exportMeasureFamilies() : [];
        results = (tasks.exportProducts) ? yield exportProducts() : [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsK0NBQStDOzs7Ozs7Ozs7O0FBRS9DLDhCQUE4QjtBQUM5QixnQ0FBZ0M7QUFDaEMsaUNBQWlDO0FBQ2pDLHNDQUFzQztBQUN0QyxzQ0FBc0M7QUFDdEMseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyw2QkFBNkI7QUFDN0IsNkJBQTZCO0FBZ0M3QixNQUFNLFVBQVUsR0FBVyxRQUFRLENBQUM7QUFFcEMsSUFBSSxNQUFNLEdBQVcsTUFBTSxDQUFDLFlBQVksQ0FBQyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQy9ELG1CQUEwQixRQUFnQjtJQUN4QyxNQUFNLEdBQUcsUUFBUSxDQUFDO0FBQ3BCLENBQUM7QUFGRCw4QkFFQztBQUVELE1BQU0sYUFBYSxHQUFhO0lBQzlCLHVCQUF1QjtJQUN2QixxQkFBcUI7SUFDckIsY0FBYztJQUNkLGlCQUFpQjtJQUNqQix3QkFBd0I7SUFDeEIsdUJBQXVCO0lBQ3ZCLGtCQUFrQjtJQUNsQixrQkFBa0I7SUFDbEIsZ0JBQWdCO0lBQ2hCLGtCQUFrQjtJQUNsQixnQkFBZ0I7SUFDaEIsc0JBQXNCO0lBQ3RCLGVBQWU7SUFDZix1QkFBdUI7SUFDdkIseUJBQXlCO0lBQ3pCLHFCQUFxQjtJQUNyQixnQkFBZ0I7SUFDaEIseUJBQXlCO0lBQ3pCLHFCQUFxQjtJQUNyQix5QkFBeUI7SUFDekIsbUNBQW1DO0lBQ25DLDZCQUE2QjtJQUM3Qix3QkFBd0I7SUFDeEIsdUJBQXVCO0lBQ3ZCLHdCQUF3QjtJQUN4QixrQkFBa0I7SUFDbEIsa0JBQWtCO0lBQ2xCLGdCQUFnQjtJQUNoQixnQkFBZ0I7SUFDaEIsc0JBQXNCO0lBQ3RCLHFCQUFxQjtJQUNyQixnQkFBZ0I7SUFDaEIseUJBQXlCO0lBQ3pCLHVDQUF1QztJQUN2QyxpQ0FBaUM7SUFDakMsOEJBQThCO0NBQy9CLENBQUM7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