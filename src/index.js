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
const baseUrl = process.env.AKENEO_BASE_URL || 'http://akeneo-pim.local';
const baseProtocol = baseUrl.slice(0, baseUrl.indexOf(':'));
const clientId = process.env.AKENEO_CLIENT_ID || '';
const exportPath = process.env.AKENEO_EXPORT_PATH || '.';
const password = process.env.AKENEO_PASSWORD || '';
const patchLimit = Number.parseInt(process.env.AKENEO_PATCH_LIMIT || '100', 10);
const promiseLimit = Number.parseInt(process.env.AKENEO_PROMISE_LIMIT || '16', 10);
const secret = process.env.AKENEO_SECRET || '';
const tokenUrl = process.env.AKENEO_TOKEN_URL || '/api/oauth/v1/token';
const username = process.env.AKENEO_USERNAME || '';
const FIVE_MINUTES = 5 * 60 * 1000;
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
exports.close = util.promisify(fs.close);
exports.open = util.promisify(fs.open);
exports.read = util.promisify(fs.readFile);
exports.unlink = util.promisify(fs.unlink);
exports.write = util.promisify(fs.write);
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
    const dirs = exportPath.split(path.sep);
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
const protocol = baseUrl.slice(0, 5) === 'https' ? _https : _http;
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
            const url = `${baseUrl}${apiUrl}`;
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
                        const fileDescriptor = yield exports.open(path.join(exportPath, 'deleteReponse.txt'), 'a');
                        yield exports.write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield exports.close(fileDescriptor);
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
            const url = `${baseUrl}${tokenUrl}`;
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
                        const fileDescriptor = yield exports.open(path.join(exportPath, 'getTokenReponse.txt'), 'a');
                        yield exports.write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield exports.close(fileDescriptor);
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
        let url = apiUrl.indexOf('?') === -1 ? `${baseUrl}${apiUrl}?limit=${patchLimit}` : `${baseUrl}${apiUrl}&limit=${patchLimit}`;
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
                            const fileDescriptor = yield exports.open(path.join(exportPath, 'getReponse.txt'), 'a');
                            yield exports.write(fileDescriptor, buffer.toString('utf8') + '\n');
                            yield exports.close(fileDescriptor);
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
                if (urlProtocol !== baseProtocol) {
                    url = url.replace(urlProtocol, baseProtocol);
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
            const url = `${baseUrl}${apiUrl}`;
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
                        const fileDescriptor = yield exports.open(path.join(exportPath, 'patchReponse.txt'), 'a');
                        yield exports.write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield exports.close(fileDescriptor);
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
                    const url = `${baseUrl}${apiUrl}`;
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
                                const fileDescriptor = yield exports.open(path.join(exportPath, 'patchVndAkeneoCollectionReponse.txt'), 'a');
                                yield exports.write(fileDescriptor, buffer.toString('utf8') + '\n');
                                yield exports.close(fileDescriptor);
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
            const url = `${baseUrl}${apiUrl}`;
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
                        const fileDescriptor = yield exports.open(path.join(exportPath, 'postReponse.txt'), 'a');
                        yield exports.write(fileDescriptor, buffer.toString('utf8') + '\n');
                        yield exports.close(fileDescriptor);
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
function postMultipartFormData(apiUrl, stream) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'postMultipartFormData';
        logger.info({ moduleName, methodName, apiUrl: apiUrl }, `Starting...`);
        const accessToken = yield getToken();
        return new Promise((resolve, reject) => {
            if (!(stream)) {
                logger.error({ moduleName, methodName, apiUrl: apiUrl }, `No Stream`);
                reject('');
            }
            const splitBaseUrl = baseUrl.split('/');
            const host = splitBaseUrl[2];
            const protocol = splitBaseUrl[0];
            const form = new FormData();
            form.append('file', stream);
            form.submit({
                protocol,
                host,
                path: apiUrl,
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }, (err, response) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    const error = err.message ? err.message : inspect(err);
                    logger.error({ moduleName, methodName, apiUrl: apiUrl, error }, `Error`);
                    reject(err);
                }
                else {
                    const statusCode = response.statusCode;
                    const statusMessage = response.statusMessage;
                    logger.info({ moduleName, methodName, apiUrl: apiUrl, statusCode });
                    logger.info({ moduleName, methodName, apiUrl: apiUrl, statusMessage });
                    if (statusCode !== 201) {
                        const object = response;
                        for (const property in object) {
                            if (object.hasOwnProperty(property)) {
                                const value = object[property];
                                logger.info({ moduleName, methodName, apiUrl: apiUrl, property, value });
                            }
                        }
                    }
                    const headers = response.headers;
                    if ((process.env.LOG_LEVEL || 'info') === 'debug') {
                        const fileDescriptor = yield exports.open(path.join(exportPath, 'postMultipartFormDataReponse.txt'), 'a');
                        yield exports.write(fileDescriptor, inspect(response.headers));
                        yield exports.close(fileDescriptor);
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
            const fileName = path.join(exportPath, exports.filenameAssociationTypes);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const associationType of associationTypes) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(associationType) + '\n'));
            }
            yield exports.close(fileDesc);
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
            yield exports.unlink(path.join(exportPath, exports.filenameAttributeOptions));
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
            const fileName = path.join(exportPath, exports.filenameAttributes);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const attribute of attributes) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(attribute) + '\n'));
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
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameAttributeGroups);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const attributeGroup of attributeGroups) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(attributeGroup) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameAttributeOptions);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const attributeOption of attributeOptions) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(attributeOption) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameCategories);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const category of categories) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(category) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameChannels);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const channel of channels) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(channel) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameCurrencies);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const currency of currencies) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(currency) + '\n'));
            }
            yield exports.close(fileDesc);
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
            yield exports.unlink(path.join(exportPath, exports.filenameFamilyVariants));
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
            const fileName = path.join(exportPath, exports.filenameFamilies);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const family of families) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(family) + '\n'));
                try {
                    yield exportFamilyVariants(family.code);
                }
                catch (err) {
                    logger.info({ moduleName, methodName, err });
                    return err;
                }
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameFamilyVariants);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const familyVariant of familyVariants) {
                // NOTE: I had to add attribute family. Even though the doc says it's
                //       not needed, it doesn't work without it.
                if (!(familyVariant.family)) {
                    familyVariant.family = familyCode;
                }
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(familyVariant) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameLocales);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const locale of locales) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(locale) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameMeasureFamilies);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const measureFamily of measureFamilies) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(measureFamily) + '\n'));
            }
            yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameProducts);
        const fileDesc = yield exports.open(fileName, 'w');
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
                yield exports.write(fileDesc, buffer);
            }));
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        logger.info({ moduleName, methodName, products: count });
        yield exports.close(fileDesc);
        return count;
    });
}
exports.exportProducts = exportProducts;
function exportProductModels() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'exportProductModels';
        logger.info({ moduleName, methodName }, 'Starting...');
        let productModels;
        try {
            productModels = yield get(`${apiUrlProductModels()}?pagination_type=search_after`);
            logger.debug({ moduleName, methodName, productModels });
        }
        catch (err) {
            logger.info({ moduleName, methodName, err });
            return err;
        }
        if (productModels !== null &&
            typeof productModels[Symbol.iterator] === 'function') {
            const fileName = path.join(exportPath, exports.filenameProductModels);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const productModel of productModels) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(productModel) + '\n'));
            }
            yield exports.close(fileDesc);
        }
        return OK;
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
            yield exports.unlink(path.join(exportPath, exports.filenameReferenceEntityAttributes));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield exports.unlink(path.join(exportPath, exports.filenameReferenceEntityAttributeOptions));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield exports.unlink(path.join(exportPath, exports.filenameReferenceEntityRecords));
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
            const fileName = path.join(exportPath, exports.filenameReferenceEntities);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const referenceEntity of referenceEntities) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(referenceEntity) + '\n'));
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
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameReferenceEntityAttributes);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const referenceEntityAttribute of referenceEntityAttributes) {
                if (!(referenceEntityAttribute.delete_reference_entity_code)) {
                    referenceEntityAttribute.delete_reference_entity_code = referenceEntityCode;
                }
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(referenceEntityAttribute) + '\n'));
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
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameReferenceEntityAttributeOptions);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const referenceEntityAttributeOption of referenceEntityAttributeOptions) {
                if (!(referenceEntityAttributeOption.delete_reference_entity_code)) {
                    referenceEntityAttributeOption.delete_reference_entity_code = referenceEntityCode;
                }
                if (!(referenceEntityAttributeOption.delete_attribute_code)) {
                    referenceEntityAttributeOption.delete_attribute_code = attributeCode;
                }
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(referenceEntityAttributeOption) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameReferenceEntityRecords);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const referenceEntityRecord of referenceEntityRecords) {
                if (!(referenceEntityRecord.delete_reference_entity_code)) {
                    referenceEntityRecord.delete_reference_entity_code = referenceEntityCode;
                }
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(referenceEntityRecord) + '\n'));
            }
            yield exports.close(fileDesc);
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
            yield exports.unlink(path.join(exportPath, exports.filenameAssetFamilyAttributes));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield exports.unlink(path.join(exportPath, exports.filenameAssetFamilyAttributeOptions));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error({ moduleName, methodName, err });
            }
        }
        try {
            yield exports.unlink(path.join(exportPath, exports.filenameAssetFamilyAssets));
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
            const fileName = path.join(exportPath, exports.filenameAssetFamilies);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const assetFamily of assetFamilies) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(assetFamily) + '\n'));
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
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameAssetFamilyAttributes);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const assetFamilyAttribute of assetFamilyAttributes) {
                if (!(assetFamilyAttribute.delete_asset_family_code)) {
                    assetFamilyAttribute.delete_asset_family_code = assetFamilyCode;
                }
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAttribute) + '\n'));
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
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameAssetFamilyAttributeOptions);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const assetFamilyAttributeOption of assetFamilyAttributeOptions) {
                if (!(assetFamilyAttributeOption.delete_asset_family_code)) {
                    assetFamilyAttributeOption.delete_asset_family_code = assetFamilyCode;
                }
                if (!(assetFamilyAttributeOption.delete_attribute_code)) {
                    assetFamilyAttributeOption.delete_attribute_code = attributeCode;
                }
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAttributeOption) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameAssetFamilyAssets);
            const fileDesc = yield exports.open(fileName, 'a');
            for (const assetFamilyAsset of assetFamilyAssets) {
                if (!(assetFamilyAsset.delete_asset_family_code)) {
                    assetFamilyAsset.delete_asset_family_code = assetFamilyCode;
                }
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAsset) + '\n'));
            }
            yield exports.close(fileDesc);
        }
        return OK;
    });
}
exports.exportAssetFamilyAssets = exportAssetFamilyAssets;
// TODO: export function exportAssetFamilyMediaFiles(): Promise<any>
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
            const fileName = path.join(exportPath, exports.filenameAssets);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const asset of assets) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(asset) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameAssetCategories);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const assetCategory of assetCategories) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(assetCategory) + '\n'));
            }
            yield exports.close(fileDesc);
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
            const fileName = path.join(exportPath, exports.filenameAssetTags);
            const fileDesc = yield exports.open(fileName, 'w');
            for (const assetTag of assetTags) {
                yield exports.write(fileDesc, Buffer.from(JSON.stringify(assetTag) + '\n'));
            }
            yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameAssociationTypes);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameAttributes);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
        if (buffer.length > 0) {
            const attributes = JSON.parse(`[ ${buffer} ]`);
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
        const fileName = path.join(exportPath, exports.filenameAttributeGroups);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
        if (buffer.length > 0) {
            const attributeGroups = JSON.parse(`[ ${buffer} ]`);
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
        const fileName = path.join(exportPath, exports.filenameAttributeOptions);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
        if (buffer.length > 0) {
            const attributeOptions = JSON.parse(`[ ${buffer} ]`);
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
        const fileName = path.join(exportPath, exports.filenameCategories);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
        if (buffer.length > 0) {
            const categories = JSON.parse(`[ ${buffer} ]`);
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
        const fileName = path.join(exportPath, exports.filenameChannels);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameFamilies);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameFamilyVariants);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
        if (buffer.length > 0) {
            const familyVariants = JSON.parse(`[ ${buffer} ]`);
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
        const fileName = path.join(exportPath, exports.filenameProducts);
        const limit = promiseLimit;
        const productsMap = new Map();
        yield load(fileName, productsMap, 'identifier');
        const identifiers = Array.from(productsMap.keys()).sort();
        let count = 0;
        let products = [];
        for (const identifier of identifiers) {
            const product = productsMap.get(identifier);
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
        return OK;
    });
}
exports.importProducts = importProducts;
function importProductModels() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importProductModels';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exportPath, exports.filenameProductModels);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
        if (buffer.length > 0) {
            const productModels = JSON.parse(`[ ${buffer} ]`);
            const results = yield patchVndAkeneoCollection(apiUrlProductModels(), productModels);
            logger.info({ moduleName, methodName, results });
        }
        return OK;
    });
}
exports.importProductModels = importProductModels;
/******************** R E F E R E N C E   E N T I T I E S ********************/
function importReferenceEntities() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importReferenceEntities';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exportPath, exports.filenameReferenceEntities);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameReferenceEntityAttributes);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameReferenceEntityAttributeOptions);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameReferenceEntityRecords);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const dirs = exportPath.split(path.sep);
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
        const handle = yield exports.open(`${dirPath}${path.sep}referenceEntityMediaFilesMap.txt`, 'a');
        for (const result of results) {
            yield exports.write(handle, `${JSON.stringify(result).toString()}\n`);
        }
        yield exports.close(handle);
        return results;
    });
}
exports.importReferenceEntityMediaFiles = importReferenceEntityMediaFiles;
/******************** A S S E T   F A M I L I E S ********************/
function importAssetFamilies() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'importAssetFamilies';
        logger.info({ moduleName, methodName }, 'Starting...');
        const fileName = path.join(exportPath, exports.filenameAssetFamilies);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameAssetFamilyAttributes);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameAssetFamilyAttributeOptions);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const fileName = path.join(exportPath, exports.filenameAssetFamilyAssets);
        const fileDesc = yield exports.open(fileName, 'r');
        const buffer = (yield exports.read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
        yield exports.close(fileDesc);
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
        const dirs = exportPath.split(path.sep);
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
        const handle = yield exports.open(`${dirPath}${path.sep}assetFamilyMediaFilesMap.txt`, 'a');
        for (const result of results) {
            yield exports.write(handle, `${JSON.stringify(result).toString()}\n`);
        }
        yield exports.close(handle);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsK0NBQStDOzs7Ozs7Ozs7O0FBRS9DLDhCQUE4QjtBQUM5QixnQ0FBZ0M7QUFDaEMsaUNBQWlDO0FBQ2pDLHNDQUFzQztBQUN0Qyx5QkFBeUI7QUFDekIscUNBQXFDO0FBQ3JDLDZCQUE2QjtBQUM3Qiw2QkFBNkI7QUFnQzdCLE1BQU0sVUFBVSxHQUFXLFFBQVEsQ0FBQztBQUVwQyxJQUFJLE1BQU0sR0FBVyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDL0QsbUJBQTBCLFFBQWdCO0lBQ3hDLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFDcEIsQ0FBQztBQUZELDhCQUVDO0FBRUQsTUFBTSxhQUFhLEdBQWE7SUFDOUIsdUJBQXVCO0lBQ3ZCLHFCQUFxQjtJQUNyQixjQUFjO0lBQ2QsaUJBQWlCO0lBQ2pCLHdCQUF3QjtJQUN4Qix1QkFBdUI7SUFDdkIsa0JBQWtCO0lBQ2xCLGtCQUFrQjtJQUNsQixnQkFBZ0I7SUFDaEIsa0JBQWtCO0lBQ2xCLGdCQUFnQjtJQUNoQixzQkFBc0I7SUFDdEIsZUFBZTtJQUNmLHVCQUF1QjtJQUN2QixxQkFBcUI7SUFDckIsZ0JBQWdCO0lBQ2hCLHlCQUF5QjtJQUN6QixxQkFBcUI7SUFDckIseUJBQXlCO0lBQ3pCLG1DQUFtQztJQUNuQyw2QkFBNkI7SUFDN0Isd0JBQXdCO0lBQ3hCLHVCQUF1QjtJQUN2Qix3QkFBd0I7SUFDeEIsa0JBQWtCO0lBQ2xCLGtCQUFrQjtJQUNsQixnQkFBZ0I7SUFDaEIsZ0JBQWdCO0lBQ2hCLHNCQUFzQjtJQUN0QixxQkFBcUI7SUFDckIsZ0JBQWdCO0lBQ2hCLHlCQUF5QjtJQUN6Qix1Q0FBdUM7SUFDdkMsaUNBQWlDO0lBQ2pDLDhCQUE4QjtDQUMvQixDQUFDO0FBRUYsY0FBYyxPQUFZLElBQUk7SUFDNUIs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