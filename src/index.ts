// https://api.akeneo.com/api-reference-60.html

import * as _http from 'http';
import * as _https from 'https';
import * as bunyan from 'bunyan';
import * as change from 'change-case';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as minimist from 'minimist';
import * as path from 'path';
import * as util from 'util';
import Logger from 'bunyan';

import { AssetFamily } from './interfaces/AssetFamily';
import { AssetFamilyAttribute } from './interfaces/AssetFamilyAttribute';
import { AssetFamilyAttributeOption } from './interfaces/AssetFamilyAttributeOption';
import { AssetFamilyAsset } from './interfaces/AssetFamilyAsset';

import { Asset } from './interfaces/Asset';
import { AssetCategory } from './interfaces/AssetCategory';
import { AssetReferenceFile } from './interfaces/AssetReferenceFile';
import { AssetTag } from './interfaces/AssetTag';
import { AssetVariationFile } from './interfaces/AssetVariationFile';

import { AssociationType } from './interfaces/AssociationType';
import { Attribute } from './interfaces/Attribute';
import { AttributeGroup } from './interfaces/AttributeGroup';
import { AttributeOption } from './interfaces/AttributeOption';
import { Category } from './interfaces/Category';
import { Channel } from './interfaces/Channel';
import { Currency } from './interfaces/Currency';
import { Family } from './interfaces/Family';
import { FamilyVariant } from './interfaces/FamilyVariant';
import { Locale } from './interfaces/Locale';
import { MeasureFamily } from './interfaces/MeasureFamily';
import { Product } from './interfaces/Product';
import { ProductModel } from './interfaces/ProductModel';
import { ReferenceEntity } from './interfaces/ReferenceEntity';
import { ReferenceEntityAttribute } from './interfaces/ReferenceEntityAttribute';
import { ReferenceEntityAttributeOption } from './interfaces/ReferenceEntityAttributeOption';
import { ReferenceEntityRecord } from './interfaces/ReferenceEntityRecord';

const moduleName: string = 'akeneo';

let logger: Logger = bunyan.createLogger({ name: moduleName });
export function setLogger(loggerIn: Logger) {
  logger = loggerIn;
}

const possibleTasks: string[] = [
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

function argz(args: any = null): any {
  const methodName: string = 'argz';

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
  const pkg: any  = JSON.parse(fs.readFileSync('package.json').toString());
  const name: string = pkg.name ? pkg.name : '';
  const version: string = pkg.version ? pkg.version : '';
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
  const parameter: string = localArgs.parameter ? localArgs.parameter : '';
  const result: any = { tasks: {}, parameter };
  const tasks: any[] = localArgs.tasks.split(',');
  for (const task of tasks) {
    let found: boolean = false;
    for (const possibleTask of possibleTasks) {
      if (possibleTask === task) {
        found = true;
        break;
      }
    }
    if (found) {
      result.tasks[task] = true;
    } else {
      console.error(`Task: ${task}, is not in the list of supported tasks: ${possibleTasks.join(', ')}.`);
      setTimeout(() => { process.exit(1); }, 10000);
    }
  }
  return result;
}


export function inspect(obj: any, depth: number = 5): string {
  return `${util.inspect(obj, true, depth, false)}`;
}

export function load(filename: string, map: Map<string, any>, key: any): Promise<any> {
  const methodName: string = 'load';
  logger.debug({ moduleName, methodName, filename, map, key }, `Starting`);
  
  return new Promise((resolve, reject) => {
    let stream: any = null;

    if (filename) {
      let stat: any = null;
      try {
        stat = fs.statSync(filename);
      } catch(err) {
        if (err.code !== 'ENOENT') {
          const error: any = err.message ? err.message : err;
          logger.error({ moduleName, methodName, error }, `Error!`);
        }
        return resolve(map);
      }
      if (stat &&
        stat.size > 0) {
        stream = fs.createReadStream(filename);
      } else {
        return resolve(map); 
      }
    }

    const timer = setTimeout(() => { 
      const error: string = 'timed out.';
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

      stream.on('data', (chunk: string) => {
        clearTimeout(timer);
        data += chunk;
        let linefeed = 0;
        while ((linefeed = data.indexOf('\n')) > -1) {
          const json = data.slice(0, linefeed).trim();
          try {
            const doc = JSON.parse(json);
            let keyValue: string = '';
            if (key instanceof Array) {
              for (const element of key) {
                keyValue += doc[element];
              }
            } else {
              // it's a string
              keyValue += doc[key];
            }
            map.set(keyValue, doc);
          } catch (err) {
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
            let keyValue: string = '';
            if (key instanceof Array) {
              for (const element of key) {
                keyValue += doc[element];
              }
            } else {
              // it's a string
              keyValue += doc[key];
            }
            map.set(keyValue, doc);
          }
        }
        logger.info({ moduleName, methodName, filename, map, key, size: map.size }, `${map.size} records loaded.`);
      });

      stream.on('error', (err: any) => {
        clearTimeout(timer);
        const error: any = err.message ? err.message : err;
        logger.error({ moduleName, methodName, error }, `stream.on error: ${err.message}`);
        reject(error);
      });
    }
  });  
} 

export let baseUrl: string = (process.env.AKENEO_BASE_URL as string) || 'http://akeneo-pim.local';
export let exportPath: string = (process.env.AKENEO_EXPORT_PATH as string) || '.';
export let patchLimit: number = Number.parseInt((process.env.AKENEO_PATCH_LIMIT as string) || '100', 10);
export let promiseLimit: number = Number.parseInt((process.env.AKENEO_PROMISE_LIMIT as string) || '16', 10);
let clientId: string = (process.env.AKENEO_CLIENT_ID as string) || '';
let password: string = (process.env.AKENEO_PASSWORD as string) || '';
let secret: string = (process.env.AKENEO_SECRET as string) || '';
let tokenUrl: string = (process.env.AKENEO_TOKEN_URL as string) || '/api/oauth/v1/token';
let username: string = (process.env.AKENEO_USERNAME as string) || '';

export function baseProtocol(): string {
  return baseUrl.slice(0, baseUrl.indexOf(':'));
}

export function setBaseUrl(value: string) {
  baseUrl = value;
}
export function setClientId(value: string) {
  clientId = value;
}
export function setExportPath(value: string) {
  exportPath = value;
}
export function setPassword(value: string) {
  password = value;
}
export function setSecret(value: string) {
  secret = value;
}
export function setUsername(value: string) {
  username = value;
}

const OK: any = { status: 'OK' };

export const AKENEO_CATEGORIES: string = 'categories';

export const AKENEO_REFERENCE_ENTITY: string            = 'akeneo_reference_entity';
export const AKENEO_REFERENCE_ENTITY_COLLECTION: string = 'akeneo_reference_entity_collection';
export const PIM_CATALOG_ASSET_COLLECTION: string       = 'pim_catalog_asset_collection';      
export const PIM_CATALOG_BOOLEAN: string                = 'pim_catalog_boolean';
export const PIM_CATALOG_DATE: string                   = 'pim_catalog_date';
export const PIM_CATALOG_FILE: string                   = 'pim_catalog_file';
export const PIM_CATALOG_IDENTIFIER: string             = 'pim_catalog_identifier';
export const PIM_CATALOG_IMAGE: string                  = 'pim_catalog_image';
export const PIM_CATALOG_METRIC: string                 = 'pim_catalog_metric';
export const PIM_CATALOG_MULTISELECT: string            = 'pim_catalog_multiselect';
export const PIM_CATALOG_NUMBER: string                 = 'pim_catalog_number';
export const PIM_CATALOG_PRICE_COLLECTION: string       = 'pim_catalog_price_collection';
export const PIM_CATALOG_SIMPLESELECT: string           = 'pim_catalog_simpleselect';
export const PIM_CATALOG_TABLE: string                  = 'pim_catalog_table';
export const PIM_CATALOG_TEXT: string                   = 'pim_catalog_text';
export const PIM_CATALOG_TEXTAREA: string               = 'pim_catalog_textarea';
export const PIM_REFERENCE_DATA_MULTISELECT: string     = 'pim_reference_data_multiselect';
export const PIM_REFERENCE_DATA_SIMPLESELECT: string    = 'pim_reference_data_simpleselect';

export const ATTRIBUTE_TYPES: Set<string> = new Set([
  AKENEO_REFERENCE_ENTITY,
  AKENEO_REFERENCE_ENTITY_COLLECTION,
  PIM_CATALOG_ASSET_COLLECTION,
  PIM_CATALOG_BOOLEAN,
  PIM_CATALOG_DATE,
  PIM_CATALOG_FILE,
//  PIM_CATALOG_IDENTIFIER, there can be only one identifier
  PIM_CATALOG_IMAGE,
  PIM_CATALOG_METRIC,
  PIM_CATALOG_MULTISELECT,
  PIM_CATALOG_NUMBER,
  PIM_CATALOG_PRICE_COLLECTION,
  PIM_CATALOG_SIMPLESELECT,
  PIM_CATALOG_TABLE,
  PIM_CATALOG_TEXT,
  PIM_CATALOG_TEXTAREA,
  PIM_REFERENCE_DATA_MULTISELECT,
  PIM_REFERENCE_DATA_SIMPLESELECT
]);

export const REFERENCE_ENTITY_IMAGE: string = 'image';
export const REFERENCE_ENTITY_MULTIPLE_OPTIONS: string = 'multiple_options';
export const REFERENCE_ENTITY_NUMBER: string = 'number';
export const REFERENCE_ENTITY_MULTIPLE_LINKS: string = 'reference_entity_multiple_links';
export const REFERENCE_ENTITY_SINGLE_LINK: string = 'reference_entity_single_link';
export const REFERENCE_ENTITY_SINGLE_OPTION: string = 'single_option';
export const REFERENCE_ENTITY_TEXT: string = 'text';
// Yes, I know, there isn't a textarea type, it's text + textarea boolean, but I need to differentiate
export const REFERENCE_ENTITY_TEXTAREA: string = 'textarea';

export const ASSET_FAMILY_MEDIA_FILE: string = 'media_file';
export const ASSET_FAMILY_MEDIA_LINK: string = 'media_link';
export const ASSET_FAMILY_MULTIPLE_OPTIONS: string = 'multiple_options';
export const ASSET_FAMILY_NUMBER: string = 'number';
export const ASSET_FAMILY_SINGLE_OPTION: string = 'single_option';
export const ASSET_FAMILY_TEXT: string = 'text';
// Yes, I know, there isn't a textarea type, it's text + textarea boolean, but I need to differentiate
export const ASSET_FAMILY_TEXTAREA: string = 'textarea'

export let filenameAssociationTypes: string = 'associationTypes.vac';
export let filenameAttributes: string = 'attributes.vac';
export let filenameAttributeGroups: string = 'attributeGroups.vac';
export let filenameAttributeOptions: string = 'attributeOptions.vac';
export let filenameCategories: string = 'categories.vac';
export let filenameChannels: string = 'channels.vac';
export let filenameCurrencies: string = 'currencies.vac';
export let filenameFamilies: string = 'families.vac';
export let filenameFamilyVariants: string = 'familyVariants.vac';
export let filenameGroups: string = 'groups.vac';
export let filenameLocales: string = 'locales.vac';
export let filenameMeasureFamilies: string = 'measureFamilies.vac';
export let filenameMeasurementFamilies: string = 'measurementFamilies.vac';
export let filenameProducts: string = 'products.vac';
export let filenameProductModels: string = 'productModels.vac';
export let filenameProductMediaFiles: string = 'productMediaFiles.vac';

export let filenameReferenceEntities: string = 'referenceEntities.vac';
export let filenameReferenceEntityAttributes: string = 'referenceEntityAttributes.vac';
export let filenameReferenceEntityAttributeOptions: string = 'referenceEntityAttributeOptions.vac';
export let filenameReferenceEntityRecords: string = 'referenceEntityRecords.vac';

export let filenameAssetFamilies: string = 'assetFamilies.vac';
export let filenameAssetFamilyAttributes: string = 'assetFamilyAttributes.vac';
export let filenameAssetFamilyAttributeOptions: string = 'assetFamilyAttributeOptions.vac';
export let filenameAssetFamilyAssets: string = 'assetFamilyAssets.vac';

// v3 
export let filenameAssets: string = 'assets.vac';
export let filenameAssetCategories: string = 'assetCategories.vac';
export let filenameAssetReferenceFiles: string = 'assetReferenceFiles.vac';
export let filenameAssetTags: string = 'assetTags.vac';
export let filenameAssetVariationFiles: string = 'assetVariationFiles.vac';
// end of v3

// Helper functions
export function close(fd: number): Promise<boolean> {
  const methodName: string = 'close';
  return new Promise((resolve: any, reject: any) => {
    fs.close(fd, (err) => {
      if (err) {
        logger.error({ moduleName, methodName, error: inspect(err) });
        return reject(err);
      } else {
        return resolve(true);
      }
    });
  });
}

export function mkdir(path: string): Promise<boolean> {
  const methodName: string = 'mkdir';
  return new Promise((resolve: any, reject: any) => {
    fs.mkdir(path, { recursive: true }, (err) => {
      if (err) {
        logger.error({ moduleName, methodName, error: inspect(err) });
        return reject(err);
      } else {
        return resolve(true)
      }
    });
  });
}

export function open(path: string, flags: string = 'r'): Promise<number> {
  const methodName: string = 'open';
  return new Promise((resolve: any, reject: any) => {
    fs.open(path, flags, (err, fd) => {
      if (err) {
        logger.error({ moduleName, methodName, error: inspect(err) });
        return reject(err);
      } else {
        return resolve(fd);
      }
    });
  });
}

export function read(fileDesc: number): Promise<Buffer> {
  const methodName: string = 'read';
  return new Promise((resolve: any, reject: any) => {
    fs.readFile(fileDesc, (err, data) => {
      if (err) {
        logger.error({ moduleName, methodName, error: inspect(err) });
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  });
}

export function stat(path: string): Promise<fs.Stats> {
  const methodName: string = 'stat';
  return new Promise((resolve:any, reject: any) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve(null);
        } else {
          logger.error({ moduleName, methodName, error: inspect(err) });
          reject(err);
        }
      } else {
        resolve(stats);
      }
    });
  });
}

export function symlink(target: string, path: string, type: any = 'dir'): Promise<boolean> {
  const methodName: string = 'symlink';
  return new Promise((resolve: any, reject: any) => {
    fs.symlink(target, path, type, (err) => {
      if (err) {
        logger.error({ moduleName, methodName, error: inspect(err) });
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

export function unlink(path: string): Promise<boolean> {
  const methodName: string = 'unlink';
  return new Promise((resolve: any, reject: any) => {
    fs.unlink(path, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve(null);
        } else {
          logger.error({ moduleName, methodName, error: inspect(err) });
          reject(err);
        }
      } else {
        return resolve(true)
      }
    });
  });
}

export function write(fd: number, data: Buffer | string): Promise<number> {
  const methodName: string = 'write';
  return new Promise((resolve: any, reject: any) => {
    fs.write(fd, data, (err, written, bufferOrString) => {
      if (err) {
        logger.error({ moduleName, methodName, error: inspect(err) });
        return reject(err);
      } else {
        return resolve(written);
      }
    });
  });
}

export function assetCode(name: string): string {
  const tokens: any[] = name.split('-');
  let code: string = '';
  if (name &&
      name.length === 36 &&
      tokens.length === 5 &&
      tokens[0].length === 8 &&
      tokens[1].length === 4 &&
      tokens[2].length === 4 &&
      tokens[3].length === 4 &&
      tokens[4].length === 12) {
    code = name.replace(/-/g, "_");
  } else {
    code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
  }
  if (code.length > 255) {
    code = code.replace(/_/g, '');
  }
  if (code.length > 255) {
    logger.debug({ moduleName, methodName: 'assetCode' },
      `WARNING: asset code truncated to 255 characters: ${code.toString()}.`);
    code = code.slice(0, 255);
  }
  
  return code;
}

export function attributeCode(name: string): string {
  const tokens: any[] = name.split('-');
  let code: string = '';
  if (name &&
      name.length === 36 &&
      tokens.length === 5 &&
      tokens[0].length === 8 &&
      tokens[1].length === 4 &&
      tokens[2].length === 4 &&
      tokens[3].length === 4 &&
      tokens[4].length === 12) {
    code = name.replace(/-/g, "_");
  } else {
    code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
  }
  if (code.length > 100) {
    code = code.replace(/_/g, '');
  }
  if (code.length > 100) {
    logger.debug({ moduleName, methodName: 'attributeCode' },
      `WARNING: attribute code truncated to 100 characters: ${code.toString()}.`);
    code = code.slice(0, 100);
  }
  
  return code;
}

export function attributeLabel(property: string): string {
  let label: string = (property[0] === '"' &&
    property[property.length - 1] === '"') ?
    property.slice(1, property.length - 1) :
    change.capitalCase(property);
  if (label.length > 255) {
        logger.debug({ moduleName, methodName: 'attributeLabel' },
          `WARNING: label truncated to 255 characters: ${label}.`);
    label = label.slice(0, 255);
  }
  
  return label;
}

export function fileCode(name: string): string {
  const tokens: any[] = name.split('-');
  let code: string = '';
  if (name &&
      name.length === 36 &&
      tokens.length === 5 &&
      tokens[0].length === 8 &&
      tokens[1].length === 4 &&
      tokens[2].length === 4 &&
      tokens[3].length === 4 &&
      tokens[4].length === 12) {
    code = name.replace(/-/g, "_");
  } else {
    code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
  }
  if (code.length > 255) {
    code = code.replace(/_/g, '');
  }
  if (code.length > 255) {
    logger.debug({ moduleName, methodName: 'fileCode' },
      `WARNING: file code truncated to 250 characters: ${code.toString()}.`);
    code = code.slice(0, 255);
  }
  
  return code;
}

export function referenceEntityCode(name: string): string {
  const tokens: any[] = name.split('-');
  let code: string = '';
  if (name &&
      name.length === 36 &&
      tokens.length === 5 &&
      tokens[0].length === 8 &&
      tokens[1].length === 4 &&
      tokens[2].length === 4 &&
      tokens[3].length === 4 &&
      tokens[4].length === 12) {
    code = name.replace(/-/g, "_");
  } else {
    code = `${change.snakeCase(name.replace(/[^0-9a-zA-Z]+/g, '_'))}`;
  }
  if (code.length > 255) {
    code = code.replace(/_/g, '');
  }
  if (code.length > 255) {
    logger.debug({ moduleName, methodName: 'referenceEntityCode' },
      `WARNING: reference entity code truncated to 255 characters: ${code.toString()}.`);
    code = code.slice(0, 255);
  }
  
  return code;
}

export function urlCode(name: string): string {
  const tokens: any[] = name.split('-');
  let code: string = '';
  if (name &&
      name.length === 36 &&
      tokens.length === 5 &&
      tokens[0].length === 8 &&
      tokens[1].length === 4 &&
      tokens[2].length === 4 &&
      tokens[3].length === 4 &&
      tokens[4].length === 12) {
    code = name.replace(/-/g, "_");
  } else {
    code = `${encodeURIComponent(name).replace(/[^0-9a-zA-Z]/g, '_')}`;
  }
  if (code.length > 255) {
    code = code.replace(/_/g, '');
  }
  if (code.length > 255) {
    logger.debug({ moduleName, methodName: 'urlCode' },
      `WARNING: url code truncated to 255 characters: ${code.toString()}.`);
    code = code.slice(0, 255);
  }
  
  return code;
}

export function deQuote(property: string): string {
  let localProperty: string = property;
  if (localProperty &&
      localProperty[0] === '"' &&
      localProperty[localProperty.length - 1] === '"') {
    localProperty = localProperty.slice(1, localProperty.length - 1);    
  }
  
  return localProperty;
}

export function mkdirs(dirParts: string[]): string {
  const methodName: string = 'mkdirs';
  logger.debug({ moduleName, methodName }, `Starting...`);
  
  const dirs: any[] = exportPath.split(path.sep);
  for (const dirPart of dirParts) {
    dirs.push(dirPart);
  }
  let dirPath: string = '';
  for (const dir of dirs) {
    if (dir !== '.') {
      dirPath += path.sep;
      dirPath += dir;
      try  {
        fs.mkdirSync(dirPath);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
    } else {
      dirPath += dir;    
    }
  }
  return dirPath;
}

// Catalog API URLs

export function apiUrlFamilies(code: string = ''): string {
  return code ? `/api/rest/v1/families/${code}` : '/api/rest/v1/families';
}

export function apiUrlFamilyVariants(familyCode: string, code: string = ''): string {
  return code ? `${apiUrlFamilies()}/${familyCode}/variants/${code}` : `${apiUrlFamilies()}/${familyCode}/variants`;
}

export function apiUrlGroups(code: string = ''): string {
  return code ? `/api/rest/v1/groups/${code}` : '/api/rest/v1/groups';
}

export function apiUrlAttributes(code: string = ''): string {
  return code ? `/api/rest/v1/attributes/${code}` : '/api/rest/v1/attributes';
}

export function apiUrlAttributeOptions(attributeCode: string, code: string = ''): string {
  return code ? `${apiUrlAttributes()}/${attributeCode}/options/${code}` : `${apiUrlAttributes()}/${attributeCode}/options`;
}

export function apiUrlAttributeGroups(code: string = ''): string {
  return code ? `/api/rest/v1/attribute-groups/${code}` : '/api/rest/v1/attribute-groups';
}

export function apiUrlAssociationTypes(code: string = ''): string {
  return code ? `/api/rest/v1/association-types/${code}` : '/api/rest/v1/association-types';
}

export function apiUrlCategories(code: string = ''): string {
  return code ? `/api/rest/v1/categories/${code}` : '/api/rest/v1/categories';
}

// Product API URLs

export function apiUrlProducts(identifier: string = ''): string {
  return identifier ? `/api/rest/v1/products/${identifier}` : '/api/rest/v1/products';
}

export function apiUrlProductModels(code: string = ''): string {
  return code ? `/api/rest/v1/product-models/${code}` : '/api/rest/v1/product-models';
}

export function apiUrlPublishedProducts(code: string = ''): string {
  return code ? `/api/rest/v1/published-products/${code}` : '/api/rest/v1/published-products';
}

export function apiUrlProductMediaFiles(code: string = ''): string {
  return code ? `/api/rest/v1/media-files/${code}` : '/api/rest/v1/media-files';
}

// Target Market URLs

export function apiUrlChannels(code: string = ''): string {
  return code ? `/api/rest/v1/channels/${code}` : '/api/rest/v1/channels';
}

export function apiUrlLocales(code: string = ''): string {
  return code ? `/api/rest/v1/locales/${code}` : '/api/rest/v1/locales';
}

export function apiUrlCurrencies(code: string = ''): string {
  return code ? `/api/rest/v1/currencies/${code}` : '/api/rest/v1/currencies';
}

export function apiUrlMeasureFamilies(code: string = ''): string {
  return code ? `/api/rest/v1/measure-families/${code}` : '/api/rest/v1/measure-families';
}

export function apiUrlMeasurementFamilies(code: string = ''): string {
  return code ? `/api/rest/v1/measurement-families/${code}` : '/api/rest/v1/measurement-families';
}

/******************** R E F E R E N C E   E N T I T I E S ********************/

export function apiUrlReferenceEntities(
  referenceEntityCode: string = ''): string {
  return referenceEntityCode ?
    `/api/rest/v1/reference-entities/${referenceEntityCode}` :
    '/api/rest/v1/reference-entities';
}

export function apiUrlReferenceEntityAttributes(
  referenceEntityCode: string,
  referenceEntityAttributeCode: string = ''): string {
  return referenceEntityAttributeCode ?
    `/api/rest/v1/reference-entities/${referenceEntityCode}/attributes/${referenceEntityAttributeCode}` :
    `/api/rest/v1/reference-entities/${referenceEntityCode}/attributes`;
}

export function apiUrlReferenceEntityAttributeOptions(
  referenceEntityCode: string,
  referenceEntityAttributeCode: string,
  referenceEntityAttributeOptionCode: string = '') {
  return referenceEntityAttributeOptionCode ?
    `/api/rest/v1/reference-entities/${referenceEntityCode}` +
    `/attributes/${referenceEntityAttributeCode}` +
    `/options/${referenceEntityAttributeOptionCode}` :
    `/api/rest/v1/reference-entities/${referenceEntityCode}` +
    `/attributes/${referenceEntityAttributeCode}/options`;
}

export function apiUrlReferenceEntityRecords(
  referenceEntityCode: string, 
  referenceEntityRecordCode: string = ''): string {
  return referenceEntityRecordCode ?
    `/api/rest/v1/reference-entities/${referenceEntityCode}/records/${referenceEntityRecordCode}` :
    `/api/rest/v1/reference-entities/${referenceEntityCode}/records`;
}

export function apiUrlReferenceEntityMediaFiles(
  referenceEntityMediaFileCode: string = ''): string {
  return referenceEntityMediaFileCode ?
    `/api/rest/v1/reference-entities-media-files/${referenceEntityMediaFileCode}` :
    '/api/rest/v1/reference-entities-media-files';
}

/******************** A S S E T   F A M I L I E S ********************/

export function apiUrlAssetFamilies(
  assetFamilyCode: string = ''): string {
  return assetFamilyCode ?
    `/api/rest/v1/asset-families/${assetFamilyCode}` :
    '/api/rest/v1/asset-families';
}

export function apiUrlAssetFamilyAttributes(
  assetFamilyCode: string,
  assetFamilyAttributeCode: string = ''): string {
  return assetFamilyAttributeCode ?
    `/api/rest/v1/asset-families/${assetFamilyCode}/attributes/${assetFamilyAttributeCode}` :
    `/api/rest/v1/asset-families/${assetFamilyCode}/attributes`;
}

export function apiUrlAssetFamilyAttributeOptions(
  assetFamilyCode: string,
  assetFamilyAttributeCode: string,
  assetFamilyAttributeOptionCode: string = ''): string {
   return assetFamilyAttributeOptionCode ?
    `/api/rest/v1/asset-families/${assetFamilyCode}` +
    `/attributes/${assetFamilyAttributeCode}` +
    `/options/${assetFamilyAttributeOptionCode}` :
    `/api/rest/v1/asset-families/${assetFamilyCode}` +
    `/attributes/${assetFamilyAttributeCode}` +
    `/options`;
}

export function apiUrlAssetFamilyMediaFiles(
  assetFamilyAssetCode: string = ''): string {
  return assetFamilyAssetCode ?
    `/api/rest/v1/asset-media-files/${assetFamilyAssetCode}` :
    `/api/rest/v1/asset-media-files`;
}

export function apiUrlAssetFamilyAssets(
  assetFamilyCode: string,
  assetFamilyAssetCode: string = ''): string {
  return assetFamilyAssetCode ?
    `/api/rest/v1/asset-families/${assetFamilyCode}/assets/${assetFamilyAssetCode}` :
    `/api/rest/v1/asset-families/${assetFamilyCode}/assets`;
}

// v3 PAM

export function apiUrlAssets(): string {
  return `/api/rest/v1/assets`;
}

export function apiUrlAssetReferenceFiles(assetCode: string, localeCode: string): string {
  return `/api/rest/v1/assets/${assetCode}/reference-files/${localeCode}`;
}

export function apiUrlAssetVariationFiles(assetCode: string, channelCode: string, localeCode: string): string {
  return `/api/rest/v1/assets/${assetCode}/variation-files/${channelCode}/${localeCode}`;
}

export function apiUrlAssetCategories(): string {
  return '/api/rest/v1/asset-categories';
}

export function apiUrlAssetTags(): string {
  return '/api/rest/v1/asset-tags';
}

// end of v3

/******************** H T T P / H T T P S ********************/

const protocol: any = baseUrl.slice(0, 5) === 'https' ? _https : _http;
const agent: any = new protocol.Agent({
  keepAlive: true, 
  keepAliveMsecs: 300000,
  maxSockets: Infinity
});

// delete is a reserved word
export async function delete_(apiUrl: string, data: any): Promise<any> {
  const methodName: string = 'delete_';
  logger.info({ moduleName, methodName, apiUrl }, `Starting...`);
  
  const dataString: string = JSON.stringify(data);

  const accessToken = await getToken();

  return new Promise((resolve: any, reject: any) => {
    let buffer: Buffer = Buffer.from('');
    const options: any = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString, 'utf8')
      },
      method: 'DELETE'
    };
    const url: string = `${baseUrl}${apiUrl}`;
    const request: any = protocol.request(url, options, (response: any) => {
      const statusCode: number | undefined = response.statusCode;
      const headers: any = response.headers;
      if (statusCode &&
          statusCode > 299) {
        logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
      }
      response.on('data', (data: Buffer) => {
        logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString()});
        buffer = buffer.length > 0 ? Buffer.concat([ buffer, data ]) : data;
      });

      response.on('end', async () => {
        logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString()});
        if (((process.env.LOG_LEVEL as string) || 'info') === 'debug') {
          const fileDescriptor: number = await open(path.join(exportPath, 'deleteReponse.txt'), 'a');
          await write(fileDescriptor, buffer.toString('utf8') + '\n');
          await close(fileDescriptor);
        }
        let results: any = { statusCode: response.statusCode };
        if (buffer.length > 0) {
          try {
            results = JSON.parse(buffer.toString());
            results.statusCode = response.statusCode;
          } catch (err) {
            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString()});
            const html: string = buffer.toString('utf8');
            results = {
              html,
              headers,
              statusCode
            };
            return resolve(results);
          }
        }
        return resolve(results);
      });
    });

    request.on('error', (err: any) => {
      logger.error({ moduleName, methodName, event: 'error', err});
      return reject(err);
    });

    request.write(dataString);
    request.end();
  });
}

export function splitMediaFileData(data: string): any {
  // the underscore is used to separate the guid from the actual filename
  /*
  const parts: any[] = data.split('_');
  const path: string = parts.length > 0 ? parts[0] : '';
  const name: string = parts.length > 1 ? parts.slice(1, parts.length).join('_');
  */
  const results: any = {};
  const firstUnderscoreAt: number = data.indexOf('_');
  if (firstUnderscoreAt !== -1) {
    results.path = data.slice(0, firstUnderscoreAt);
    results.name = data.slice(firstUnderscoreAt + 1, data.length);
  } else {
    results.path = '';
    results.name = data;
  }

  return results;
}

export async function download(data: string, url: string): Promise<any> {
  const methodName: string = 'download';
  logger.info({ moduleName, methodName, data, url }, `Starting...`);

  let results: any = [];

  if (!data ||
      !url) {
    return false;
  }

  logger.info({ moduleName, methodName }, `Making Dirs...`);
  const pathAndFile: any = splitMediaFileData(data);
  const pathParts: any[] = pathAndFile.path.split(path.sep);
  let pathString: string = exportPath;
  for (let i=0; i < pathParts.length; i++) {
    pathString+= `${path.sep}${pathParts[i]}`;
    try {
      await mkdir(pathString);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        logger.error({ moduleName, methodName, error: inspect(err)});
      }
    }
  }

  const accessToken = await getToken();

  const result: any = await new Promise((resolve: any, reject: any) => {
    const options: any = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream'
      },
      method: 'GET'
    };
    const request: any = protocol.request(url, options, async (response: _http.IncomingMessage) => {
      const stream: fs.WriteStream = fs.createWriteStream(path.join(path.join(exportPath, pathAndFile.path), pathAndFile.name));
      const statusCode: number | undefined = response.statusCode;
      const headers: any = response.headers;

      logger.debug({ moduleName, methodName, statusCode });

      if (statusCode &&
          statusCode > 299) {
        logger.warn({ moduleName, methodName, statusCode, headers, url}, `Error: ${response.statusMessage}`);
      }

      response.on('end', async () => {
        logger.info({ moduleName, methodName, event: 'end' });
        return resolve(OK);
      });

      response.pipe(stream);
    });

    request.on('error', async (err: any) => {
      logger.error({ moduleName, methodName, event: 'error', err});
      return reject(err);
    });

    request.end();
  });

  return result;
}

const FIVE_MINUTES: number = 5 * 60 * 1000;
let getTokenCount: number = 0;
let tokenResponse: any;
let tokenExpiresAt: number = 0;
async function getToken(): Promise<any> {
  const methodName: string = 'getToken';
  logger.debug({ moduleName, methodName }, `Starting...`);

  return new Promise((resolve: any, reject: any) => {
    if (tokenResponse &&
        tokenExpiresAt > Date.now() + FIVE_MINUTES) {
      return resolve(tokenResponse.access_token);
    } 

    let buffer: Buffer = Buffer.from('');

    const base64ClientIdSecret: string = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const basicAuthorization = `Basic ${base64ClientIdSecret}`;
    const data: string = `username=${encodeURI(username)}&password=${encodeURI(password)}&grant_type=password`;
    const options: any = {
      headers: {
        'Authorization': basicAuthorization,
        'Content-Type': `application/x-www-form-urlencoded`,
        'Content-Length': data.length // turns off chunked encoding
      },
      method: 'POST'
    };
    const url: string = `${baseUrl}${tokenUrl}`;

    const tokenRequestedAt: number = Date.now();
    const request: any = protocol.request(url, options, async (response: any) => {
      const statusCode: number | undefined = response.statusCode;
      const headers: any = response.headers;
      if (statusCode &&
          statusCode > 299) {
        logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
      }
      response.on('data', (data: Buffer) => {
        logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString()});
        buffer = buffer.length > 0 ? Buffer.concat([ buffer, data ]) : data;
      });

      response.on('end', async () => {
        logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString()});
        if (((process.env.LOG_LEVEL as string) || 'info') === 'debug') {
          const fileDescriptor: number = await open(path.join(exportPath, 'getTokenReponse.txt'), 'a');
          await write(fileDescriptor, buffer.toString('utf8') + '\n');
          await close(fileDescriptor);
        }
        let results: any = { statusCode: response.statusCode };
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
          } catch (err) {
            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString()});
            const html: string = buffer.toString('utf8');
            results = {
              html,
              headers,
              statusCode
            };
            return reject(results);
          }
        }
        return reject(results);
      });
    });

    request.on('error', (err: any) => {
      logger.error({ moduleName, methodName, event: 'error', err});
      return reject(err);
    });

    request.write(data);

    request.end();
  });
}

export async function get(apiUrl: string, callback: any = null): Promise<any> {
  const methodName: string = 'get';
  logger.info({ moduleName, methodName, apiUrl }, `Starting...`);

  let results: any = [];

  let url: string = apiUrl.indexOf('?') === -1 ? `${baseUrl}${apiUrl}?limit=${patchLimit}` : `${baseUrl}${apiUrl}&limit=${patchLimit}`;
  for ( ; ; ) {
    const accessToken = await getToken();

    const result: any = await new Promise((resolve: any, reject: any) => {

      let buffer: Buffer = Buffer.from('');
      const options: any = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        method: 'GET'
      };
      const request: any = protocol.request(url, options, async (response: _http.IncomingMessage) => {
        const statusCode: number | undefined = response.statusCode;
        const headers: any = response.headers;

        logger.debug({ moduleName, methodName, statusCode });

        if (statusCode &&
            statusCode > 299) {
          logger.warn({ moduleName, methodName, statusCode, headers, url}, `Error: ${response.statusMessage}`);
        }

        response.on('data', (data: Buffer) => {
          logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString()});
          buffer = buffer.length > 0 ? Buffer.concat([ buffer, data ]) : data;
        });

        response.on('end', async () => {
          logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString()});
          if (((process.env.LOG_LEVEL as string) || 'info') === 'debug') {
            const fileDescriptor: number = await open(path.join(exportPath, 'getReponse.txt'), 'a');
            await write(fileDescriptor, buffer.toString('utf8') + '\n');
            await close(fileDescriptor);
          }
          let results: any = { statusCode };
          if (buffer.length > 0) {
            try {
              results = JSON.parse(buffer.toString());
              if (!(results instanceof Array)) {
                results.headers = headers;
                results.statusCode = statusCode;
              }
            } catch (err) {
              logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString()});
              const html: string = buffer.toString('utf8');
              results = {
                html,
                headers,
                statusCode
              };
              return resolve(results);
            }
          }
          return resolve(results);
        });
      });

      request.on('error', (err: any) => {
        logger.error({ moduleName, methodName, event: 'error', err});
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
    } else
    if (result &&
        result.identifier) {
      delete result.headers;
      delete result.status_code;
      results.push(result);
    } else
    if (result &&
        result instanceof Array) {
      for (const element of result) {
        results.push(element);
      }
    } else {
      logger.debug({ moduleName, methodName, result }, `Error: unsupported data structure.`);
      process.exit(99);
    }

    if (callback) {
      await callback(results);
      results = [];
    }

    if (result &&
        result._links &&
        result._links.next &&
        result._links.next.href) {
      url = result._links.next.href;
      const urlProtocol: string = url.slice(0, url.indexOf(':'));
      if (urlProtocol !== baseProtocol()) {
        url = url.replace(urlProtocol, baseProtocol());
      }
    } else {
      url = '';
    }

    if (url === '') {
      if (callback) {
        await callback(results);
        results = [];
      }
      break;
    }
  }

  return results;
}

export async function patch(apiUrl: string, data: any): Promise<any> {
  const methodName: string = 'patch';
  logger.info({ moduleName, methodName, apiUrl }, `Starting...`);
  
  const dataString: string = JSON.stringify(data);
  logger.debug({ moduleName, methodName, dataString });

  const accessToken = await getToken();

  return new Promise((resolve: any, reject: any) => {
    let buffer: Buffer = Buffer.from('');
    const options: any = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString, 'utf8')
      },
      method: 'PATCH'
    };
    const url: string = `${baseUrl}${apiUrl}`;
    const request: any = protocol.request(url, options, async (response: any) => {
      const statusCode: number | undefined = response.statusCode;
      const headers: any = response.headers;
      logger.debug({ moduleName, methodName, statusCode, headers });
      if (statusCode &&
          statusCode > 299) {
        logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
      }
      response.on('data', (data: Buffer) => {
        logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString()});
        buffer = buffer.length > 0 ? Buffer.concat([ buffer, data ]) : data;
      });

      response.on('end', async () => {
        logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString()});
        if (((process.env.LOG_LEVEL as string) || 'info') === 'debug') {
          const fileDescriptor: number = await open(path.join(exportPath, 'patchReponse.txt'), 'a');
          await write(fileDescriptor, buffer.toString('utf8') + '\n');
          await close(fileDescriptor);
        }
        let results: any = { statusCode };
        if (buffer.length > 0) {
          try {
            results = JSON.parse(buffer.toString());
            results.statusCode = response.statusCode;
          } catch (err) {
            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString()});
            const html: string = buffer.toString('utf8');
            results = {
              html,
              headers,
              statusCode
            };
            return resolve(results);
          }
        }
        return resolve(results);
      });
    });

    request.on('error', (err: any) => {
      logger.error({ moduleName, methodName, event: 'error', err});
      return reject(err);
    });

    request.write(dataString);
    request.end();
  });
}

export async function patchVndAkeneoCollection(apiUrl: string, docs: any[]): Promise<any> {
  const methodName: string = 'patchVndAkeneoCollection';
  logger.info({ moduleName, methodName, apiUrl, docs: docs.length }, `Starting...`);
  
  const results: any = {
    responses: [],
    statusCode: -1
  };

  let dataArray: string[] = [];
  let dataString: string = '';
  for (let i = 0; i < docs.length; i++) {
    dataArray.push(JSON.stringify(docs[i]));
    if ((1 + i) % patchLimit === 0 ||
         1 + i === docs.length) {

      dataString = `${dataArray.join('\n')}`;
      
      const accessToken = await getToken();
      
      const result: any = await new Promise((resolve: any, reject: any) => {
        let buffer: Buffer = Buffer.from('');
        const options: any = {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/vnd.akeneo.collection+json',
            'Content-Length': Buffer.byteLength(dataString, 'utf8')
          },
          method: 'PATCH'
        };
        const url: string = `${baseUrl}${apiUrl}`;
        const request: any = protocol.request(url, options, async (response: any) => {
          const statusCode: number | undefined = response.statusCode;
          const headers: any = response.headers;
          if (statusCode &&
              statusCode > 299) {
            logger.error({ moduleName, methodName, statusCode, headers, url, dataString }, `Error: ${response.statusMessage}`);
          }
          if (statusCode === 502) {
            // bad gateway
            tokenResponse = null;
          }
          response.on('data', (data: Buffer) => {
            logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString()});
            buffer = buffer.length > 0 ? Buffer.concat([ buffer, data ]) : data;
          });

          response.on('end', async () => {
            logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString()});
            if (((process.env.LOG_LEVEL as string) || 'info') === 'debug') {
              const fileDescriptor: number = await open(path.join(exportPath, 'patchVndAkeneoCollectionReponse.txt'), 'a');
              await write(fileDescriptor, buffer.toString('utf8') + '\n');
              await close(fileDescriptor);
            }
            let results: any = { statusCode: response.statusCode };
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
              } catch (err) {
                logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString()});
                const html: string = buffer.toString('utf8');
                results = {
                  html,
                  headers,
                  statusCode
                };
                return resolve(results);
              }
            }
            return resolve(results);
          });
        });

        request.on('error', (err: any) => {
          logger.error({ moduleName, methodName, event: 'error', err});
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
}

export async function post(apiUrl: string, data: string): Promise<any> {
  const methodName: string = 'post';
  logger.debug({ moduleName, methodName, apiUrl }, `Starting...`);
  
  const dataString: string = JSON.stringify(data);

  const accessToken = await getToken();

  return new Promise((resolve: any, reject: any) => {
    let buffer: Buffer = Buffer.from('');
    const options: any = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString, 'utf8')
      },
      method: 'POST'
    };
    const url: string = `${baseUrl}${apiUrl}`;
    const request: any = protocol.request(url, options, async (response: any) => {
      const statusCode: number | undefined = response.statusCode;
      const headers: any = response.headers;
      if (statusCode &&
          statusCode > 299) {
        logger.error({ moduleName, methodName, statusCode, headers, url, data }, `Error: ${response.statusMessage}`);
      }
      response.on('data', (data: Buffer) => {
        logger.debug({ moduleName, methodName, event: 'data', dataString: data.toString()});
        buffer = buffer.length > 0 ? Buffer.concat([ buffer, data ]) : data;
      });

      response.on('end', async () => {
        logger.debug({ moduleName, methodName, event: 'end', bufferString: buffer.toString()});
        if (((process.env.LOG_LEVEL as string) || 'info') === 'debug') {
          const fileDescriptor: number = await open(path.join(exportPath, 'postReponse.txt'), 'a');
          await write(fileDescriptor, buffer.toString('utf8') + '\n');
          await close(fileDescriptor);
        }
        let results: any = { statusCode };
        if (buffer.length > 0) {
          try {
            results = JSON.parse(buffer.toString());
            results.statusCode = response.statusCode;
          } catch (err) {
            logger.error({ moduleName, methodName, error: err.message, buffer: buffer.toString()});
            const html: string = buffer.toString('utf8');
            results = {
              html,
              headers,
              statusCode
            };
            return resolve(results);
          }
        }
        return resolve(results);
      });
    });

    request.on('error', (err: any) => {
      logger.error({ moduleName, methodName, event: 'error', err});
      return reject(err);
    });

    request.write(dataString);
    request.end();
  });
}

// https://www.npmjs.com/package/form-data
export async function postMultipartFormData(apiUrl: string, stream: fs.ReadStream, properties: any = {}): Promise<any> {
  const methodName: string = 'postMultipartFormData';
  logger.info({ moduleName, methodName, apiUrl }, `Starting...`);

  const accessToken: string = await getToken();

  return new Promise((resolve, reject) => {
    if (!(stream)) {
      logger.error({ moduleName, methodName, apiUrl: apiUrl }, `No Stream`);
      reject('');
    } 
    const splitBaseUrl: any[] = baseUrl.split('/');
    const splitHost: any[] = splitBaseUrl[2].split(':');
    const host: string = splitHost[0];
    const port: number = Number.parseInt(splitHost[1] ? splitHost[1] : splitBaseUrl[0] === 'https:' ? '443' : '80');
    const protocol: string = splitBaseUrl[0];

    const options: any = {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      host,
      path: apiUrl,
      port,
      protocol
    };
    const form: any = new FormData();
    form.append('file', stream);
    if (properties.identifier) {
      form.append('product', JSON.stringify(properties));
    } else
    if (properties.code) {
      form.append('product_model', JSON.stringify(properties));
    }
    form.submit(options, async (err: any, response: _http.IncomingMessage) => {
      if (err) {
        const error: string = err.message ? err.message : inspect(err);
        logger.error({ moduleName, methodName, apiUrl: apiUrl, error }, `Error`);
        reject(err);
      } else {
        const statusCode: number | undefined = response.statusCode;
        const statusMessage: string | undefined = response.statusMessage;
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
        if (((process.env.LOG_LEVEL as string) || 'info') === 'debug') {
          const fileDescriptor: number = await open(path.join(exportPath, 'postMultipartFormDataReponse.txt'), 'a');
          await write(fileDescriptor, inspect(response.headers));
          await close(fileDescriptor);
        }
        let location: string | undefined = '';
        if (headers['location']) {
          location = headers['location'];
          logger.info({ moduleName, methodName, apiUrl: apiUrl, location });
        }
        let assetMediaFileCode: string | string[] | undefined = '';
        if (headers['asset-media-file-code']) {
          assetMediaFileCode = headers['asset-media-file-code'];
          logger.info({ moduleName, methodName, apiUrl: apiUrl, assetMediaFileCode });
        }
        let referenceEntitiesMediaFileCode: string | string[] | undefined = '';
        if (headers['reference-entities-media-file-code']) {
          referenceEntitiesMediaFileCode = headers['reference-entities-media-file-code'];
          logger.info({ moduleName, methodName, apiUrl: apiUrl, referenceEntitiesMediaFileCode });
        }
        if (statusCode !== 201) {
          reject(`${statusCode}: ${statusMessage}`);
        } else
        if (assetMediaFileCode) {
          resolve(assetMediaFileCode);
        } else
        if (referenceEntitiesMediaFileCode) {
          resolve(referenceEntitiesMediaFileCode);
        } else {
          resolve(location);
        }
      }
    });
  });
}

export async function exportAssociationTypes(): Promise<any> {
  const methodName: string = 'exportAssociationTypes';
  logger.info({ moduleName, methodName }, 'Starting...');

  let associationTypes: AssociationType[];
  try {
    associationTypes = await get(apiUrlAssociationTypes());
    logger.debug({ moduleName, methodName, associationTypes });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (associationTypes !== null &&
      typeof associationTypes[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssociationTypes);
    const fileDesc: number = await open(fileName, 'w');
    for (const associationType of associationTypes) {
      await write(fileDesc, Buffer.from(JSON.stringify(associationType) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportAttributes(): Promise<any> {
  const methodName: string = 'exportAttributes';
  logger.info({ moduleName, methodName }, 'Starting...');

  try {
    await unlink(path.join(exportPath, filenameAttributeOptions));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  const attributes: Attribute[] = await get(apiUrlAttributes());
  logger.debug({ moduleName, methodName, attributes });

  if (attributes !== null &&
      typeof attributes[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAttributes);
    const fileDesc: number = await open(fileName, 'w');
    for (const attribute of attributes) {
      await write(fileDesc, Buffer.from(JSON.stringify(attribute) + '\n'));
      if (attribute.type === 'pim_catalog_simpleselect' ||
          attribute.type === 'pim_catalog_multiselect') {
        try {
          await exportAttributeOptions(attribute.code);
        } catch (err) {
          logger.info({ moduleName, methodName, err });
          return err;
        }
      }
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportAttributeGroups(): Promise<any> {
  const methodName: string = 'exportAttributeGroups';
  logger.info({ moduleName, methodName }, 'Starting...');

  let attributeGroups: AttributeGroup[];
  try {
    attributeGroups = await get(apiUrlAttributeGroups());
    logger.debug({ moduleName, methodName, attributeGroups });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (attributeGroups !== null &&
      typeof attributeGroups[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAttributeGroups);
    const fileDesc: number = await open(fileName, 'w');
    for (const attributeGroup of attributeGroups) {
      await write(fileDesc, Buffer.from(JSON.stringify(attributeGroup) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportAttributeOptions(attributeCode: string): Promise<any> {
  const methodName: string = 'exportAttributeOptions';
  logger.info({ moduleName, methodName, attributeCode }, 'Starting...');

  let attributeOptions: AttributeOption[];
  try {
    attributeOptions = await get(apiUrlAttributeOptions(attributeCode));
    logger.debug({ moduleName, methodName, attributeOptions });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (attributeOptions !== null &&
      typeof attributeOptions[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAttributeOptions);
    const fileDesc: number = await open(fileName, 'a');
    for (const attributeOption of attributeOptions) {
      await write(fileDesc, Buffer.from(JSON.stringify(attributeOption) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportCategories(): Promise<any> {
  const methodName: string = 'exportCategories';
  logger.info({ moduleName, methodName }, 'Starting...');

  let categories: Category[];
  try {
    categories = await get(apiUrlCategories());
    logger.debug({ moduleName, methodName, categories });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (categories !== null &&
      typeof categories[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameCategories);
    const fileDesc: number = await open(fileName, 'w');
    for (const category of categories) {
      await write(fileDesc, Buffer.from(JSON.stringify(category) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportChannels(): Promise<any> {
  const methodName: string = 'exportChannels';
  logger.info({ moduleName, methodName }, 'Starting...');

  let channels: Channel[];
  try {
    channels = await get(apiUrlChannels());
    logger.debug({ moduleName, methodName, channels });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (channels !== null &&
      typeof channels[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameChannels);
    const fileDesc: number = await open(fileName, 'w');
    for (const channel of channels) {
      await write(fileDesc, Buffer.from(JSON.stringify(channel) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportCurrencies(): Promise<any> {
  const methodName: string = 'exportCurrencies';
  logger.info({ moduleName, methodName }, 'Starting...');

  let currencies: Currency[];
  try {
    currencies = await get(apiUrlCurrencies());
    logger.debug({ moduleName, methodName, currencies });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (currencies !== null &&
      typeof currencies[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameCurrencies);
    const fileDesc: number = await open(fileName, 'w');
    for (const currency of currencies) {
      await write(fileDesc, Buffer.from(JSON.stringify(currency) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportFamilies(): Promise<any> {
  const methodName: string = 'exportFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');

  try {
    await unlink(path.join(exportPath, filenameFamilyVariants));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  let families: Family[];
  try {
    families = await get(apiUrlFamilies());
    logger.debug({ moduleName, methodName, families });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (families !== null &&
      typeof families[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameFamilies);
    const fileDesc: number = await open(fileName, 'w');
    for (const family of families) {
      if (family.code) {
        await write(fileDesc, Buffer.from(JSON.stringify(family) + '\n'));
        try {
          await exportFamilyVariants(family.code);
        } catch (err) {
          logger.info({ moduleName, methodName, err });
          return err;
        }
      }
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportFamilyVariants(familyCode: string): Promise<any> {
  const methodName: string = 'exportFamilyVariants';
  logger.info({ moduleName, methodName, familyCode }, 'Starting...');

  let familyVariants: FamilyVariant[];
  try {
    familyVariants = await get(apiUrlFamilyVariants(familyCode));
    logger.debug({ moduleName, methodName, familyVariants });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (familyVariants !== null &&
      typeof familyVariants[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameFamilyVariants);
    const fileDesc: number = await open(fileName, 'a');
    for (const familyVariant of familyVariants) {
      // NOTE: I had to add attribute family. Even though the doc says it's
      //       not needed, it doesn't work without it.
      if (!(familyVariant.family)) {
        familyVariant.family = familyCode;
      }
      await write(fileDesc, Buffer.from(JSON.stringify(familyVariant) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportGroups(): Promise<any> {
  const methodName: string = 'exportGroups';
  logger.info({ moduleName, methodName }, 'Starting...');

  let Groups: any[];
  try {
    Groups = await get(apiUrlGroups());
    logger.debug({ moduleName, methodName, Groups });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (Groups !== null &&
      typeof Groups[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameGroups);
    const fileDesc: number = await open(fileName, 'w');
    for (const Group of Groups) {
      await write(fileDesc, Buffer.from(JSON.stringify(Group) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportLocales(): Promise<any> {
  const methodName: string = 'exportLocales';
  logger.info({ moduleName, methodName }, 'Starting...');

  let locales: Locale[];
  try {
    locales = await get(apiUrlLocales());
    logger.debug({ moduleName, methodName, locales });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (locales !== null &&
      typeof locales[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameLocales);
    const fileDesc: number = await open(fileName, 'w');
    for (const locale of locales) {
      await write(fileDesc, Buffer.from(JSON.stringify(locale) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportMeasureFamilies(): Promise<any> {
  const methodName: string = 'exportMeasureFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');

  let measureFamilies: MeasureFamily[];
  try {
    measureFamilies = await get(apiUrlMeasureFamilies());
    logger.debug({ moduleName, methodName, measureFamilies });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (measureFamilies !== null &&
      typeof measureFamilies[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameMeasureFamilies);
    const fileDesc: number = await open(fileName, 'w');
    for (const measureFamily of measureFamilies) {
      await write(fileDesc, Buffer.from(JSON.stringify(measureFamily) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportMeasurementFamilies(): Promise<any> {
  const methodName: string = 'exportMeasurementFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');

  let measurementFamilies: any[];
  try {
    measurementFamilies = await get(apiUrlMeasurementFamilies());
    logger.debug({ moduleName, methodName, measurementFamilies });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (measurementFamilies !== null &&
      typeof measurementFamilies[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameMeasurementFamilies);
    const fileDesc: number = await open(fileName, 'w');
    for (const measurementFamily of measurementFamilies) {
      await write(fileDesc, Buffer.from(JSON.stringify(measurementFamily) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportProducts(parameters: string = ''): Promise<any> {
  const methodName: string = 'exportProducts';
  logger.info({ moduleName, methodName }, 'Starting...');

  let products: Product[];
  const fileName: string = path.join(exportPath, filenameProducts);
  const fileDesc: number = await open(fileName, 'w');
  let count: number = 0;

  try {
    products = await get(parameters ?
      `${apiUrlProducts()}?pagination_type=search_after&${parameters}` :
      `${apiUrlProducts()}?pagination_type=search_after`, async (results: any) => {
      let vac: string = '';
      for (const result of results) {
        vac += JSON.stringify(result) + '\n';
        ++count;
      }
      const buffer: Buffer = Buffer.from(vac);
      
      await write(fileDesc, buffer); 
    });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  logger.info({ moduleName, methodName, products: count });
  await close(fileDesc);

  logger.info({ moduleName, methodName }, 'Exporting linked images...');

  const productMediaFilesMap: Map<string, any> = new Map();
  let stats: fs.Stats | null = await stat(path.join(exportPath, filenameProductMediaFiles));
  if (stats) {
    await load(path.join(exportPath, filenameProductMediaFiles), productMediaFilesMap, 'fromHref');
  }
  const productsMap: Map<string, any> = new Map();
  await load(fileName, productsMap, 'identifier');
  for (const product of productsMap.values()) {
    const valueAttributes: any = product.values ? product.values : {};
    for (const valueAttribute in valueAttributes) {
      for (const valueObject of valueAttributes[valueAttribute]) {
        if (valueObject.data &&
            valueObject._links &&
            valueObject._links.download &&
            valueObject._links.download.href) {
          const data: string = valueObject.data || '';
          const href: string = valueObject._links.download.href || '';
          if (!(productMediaFilesMap.has(href))) {
            const downloadResults: any = await download(data, href);
            if (downloadResults === OK) {
              productMediaFilesMap.set(href, { fromData: data, fromHref: href });
            }
          }
        }
      }
    }
  }
  const mediaFileDesc: number = await open(path.join(exportPath, filenameProductMediaFiles), 'w');
  for (const productMediaFile of productMediaFilesMap.values()) {
    await write(mediaFileDesc, `${JSON.stringify(productMediaFile)}\n`);
  }
  await close(mediaFileDesc);

  return count;
}

export async function exportProductModels(): Promise<any> {
  const methodName: string = 'exportProductModels';
  logger.info({ moduleName, methodName }, 'Starting...');

  let productModels: ProductModel[];
  const fileName: string = path.join(exportPath, filenameProductModels);
  const fileDesc: number = await open(fileName, 'w');
  let count: number = 0;

  try {
    productModels = await get(`${apiUrlProductModels()}?pagination_type=search_after`, async (results: any) => {
      let vac: string = '';
      for (const result of results) {
        vac += JSON.stringify(result) + '\n';
        ++count;
      }
      const buffer: Buffer = Buffer.from(vac);
      
      await write(fileDesc, buffer); 
    });
    logger.debug({ moduleName, methodName, productModels });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  logger.info({ moduleName, methodName, productModels: count });
  await close(fileDesc);

  logger.info({ moduleName, methodName }, 'Exporting linked images...');

  const productMediaFilesMap: Map<string, any> = new Map();
  let stats: fs.Stats | null = await stat(path.join(exportPath, filenameProductMediaFiles));
  if (stats) {
    await load(path.join(exportPath, filenameProductMediaFiles), productMediaFilesMap, 'fromHref');
  }
  const productModelsMap: Map<string, any> = new Map();
  await load(fileName, productModelsMap, 'code');
  for (const productModel of productModelsMap.values()) {
    const valueAttributes: any = productModel.values ? productModel.values : {};
    for (const valueAttribute in valueAttributes) {
      for (const valueObject of valueAttributes[valueAttribute]) {
        if (valueObject.data &&
            valueObject._links &&
            valueObject._links.download &&
            valueObject._links.download.href) {
          const data: string = valueObject.data || '';
          const href: string = valueObject._links.download.href || '';
          if (!(productMediaFilesMap.has(href))) {
            const downloadResults: any = await download(data, href);
            if (downloadResults === OK) {
              productMediaFilesMap.set(href, { fromData: data, fromHref: href });
            }
          }
        }
      }
    }
  }
  const mediaFileDesc: number = await open(path.join(exportPath, filenameProductMediaFiles), 'w');
  for (const productMediaFile of productMediaFilesMap.values()) {
    await write(mediaFileDesc, `${JSON.stringify(productMediaFile)}\n`);
  }
  await close(mediaFileDesc);

  return count;
}

// TODO: export function exportPublishedProduct(): Promise<any>
// TODO: export function exportProductMediaFile(): Promise<any>

/******************** R E F E R E N C E   E N T I T I E S ********************/

export async function exportReferenceEntities(): Promise<any> {
  const methodName: string = 'exportReferenceEntities';
  logger.info({ moduleName, methodName }, 'Starting...');

  try {
    await unlink(path.join(exportPath, filenameReferenceEntityAttributes));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  try {
    await unlink(path.join(exportPath, filenameReferenceEntityAttributeOptions));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  try {
    await unlink(path.join(exportPath, filenameReferenceEntityRecords));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  let referenceEntities: ReferenceEntity[];
  try {
    referenceEntities = await get(apiUrlReferenceEntities());
    logger.debug({ moduleName, methodName, referenceEntities });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (referenceEntities !== null &&
      typeof referenceEntities[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameReferenceEntities);
    const fileDesc: number = await open(fileName, 'w');
    for (const referenceEntity of referenceEntities) {
      await write(fileDesc, Buffer.from(JSON.stringify(referenceEntity) + '\n'));
      try {
        await exportReferenceEntityAttributes(referenceEntity.code);
      } catch (err) {
        logger.info({ moduleName, methodName, err });
        return err;
      }
      try {
        await exportReferenceEntityRecords(referenceEntity.code);
      } catch (err) {
        logger.info({ moduleName, methodName, err });
        return err;
      }
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportReferenceEntityAttributes(referenceEntityCode: string): Promise<any> {
  const methodName: string = 'exportReferenceEntityAttributes';
  logger.info({ moduleName, methodName }, 'Starting...');

  let referenceEntityAttributes: ReferenceEntityAttribute[];
  try {
    referenceEntityAttributes = await get(apiUrlReferenceEntityAttributes(referenceEntityCode));
    logger.debug({ moduleName, methodName, referenceEntityAttributes });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (referenceEntityAttributes !== null &&
      typeof referenceEntityAttributes[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameReferenceEntityAttributes);
    const fileDesc: number = await open(fileName, 'a');
    for (const referenceEntityAttribute of referenceEntityAttributes) {
      if (!(referenceEntityAttribute.delete_reference_entity_code)) {
        referenceEntityAttribute.delete_reference_entity_code = referenceEntityCode;
      }
      await write(fileDesc, Buffer.from(JSON.stringify(referenceEntityAttribute) + '\n'));
      if (referenceEntityAttribute.type === 'multiple_options' ||
          referenceEntityAttribute.type === 'single_option') {
        try {
          await exportReferenceEntityAttributeOptions(referenceEntityCode, referenceEntityAttribute.code);
        } catch (err) {
          logger.info({ moduleName, methodName, err });
          return err;
        }
      }
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportReferenceEntityAttributeOptions(referenceEntityCode: string,
                                                            attributeCode: string): Promise<any> {
  const methodName: string = 'exportReferenceEntityAttributeOptions';
  logger.info({ moduleName, methodName }, 'Starting...');

  let referenceEntityAttributeOptions: ReferenceEntityAttributeOption[] = [];
  try {
    referenceEntityAttributeOptions = await get(apiUrlReferenceEntityAttributeOptions(referenceEntityCode,
                                                                                      attributeCode));
    logger.debug({ moduleName, methodName, referenceEntityAttributeOptions });
  } catch (err) {
    if (err.code && err.code !== 404) {
      logger.info({ moduleName, methodName, err });
      return err;
    }
  }
  if (referenceEntityAttributeOptions !== null &&
      typeof referenceEntityAttributeOptions[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameReferenceEntityAttributeOptions);
    const fileDesc: number = await open(fileName, 'a');
    for (const referenceEntityAttributeOption of referenceEntityAttributeOptions) {
      if (!(referenceEntityAttributeOption.delete_reference_entity_code)) {
        referenceEntityAttributeOption.delete_reference_entity_code = referenceEntityCode;
      }
      if (!(referenceEntityAttributeOption.delete_attribute_code)) {
        referenceEntityAttributeOption.delete_attribute_code = attributeCode;
      }
      await write(fileDesc, Buffer.from(JSON.stringify(referenceEntityAttributeOption) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportReferenceEntityRecords(referenceEntityCode: string): Promise<any> {
  const methodName: string = 'exportReferenceEntityRecords';
  logger.info({ moduleName, methodName }, 'Starting...');

  let referenceEntityRecords: ReferenceEntityRecord[];
  try {
    referenceEntityRecords = await get(apiUrlReferenceEntityRecords(referenceEntityCode));
    logger.debug({ moduleName, methodName, referenceEntityRecords });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (referenceEntityRecords !== null &&
      typeof referenceEntityRecords[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameReferenceEntityRecords);
    const fileDesc: number = await open(fileName, 'a');
    for (const referenceEntityRecord of referenceEntityRecords) {
      if (!(referenceEntityRecord.delete_reference_entity_code)) {
        referenceEntityRecord.delete_reference_entity_code = referenceEntityCode;
      }
      await write(fileDesc, Buffer.from(JSON.stringify(referenceEntityRecord) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

// TODO: export function exportReferenceEntityMediaFile(): Promise<any>

/******************** A S S E T   F A M I L I E S ********************/

export async function exportAssetFamilies(): Promise<any> {
  const methodName: string = 'exportAssetFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');

  try {
    await unlink(path.join(exportPath, filenameAssetFamilyAttributes));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  try {
    await unlink(path.join(exportPath, filenameAssetFamilyAttributeOptions));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  try {
    await unlink(path.join(exportPath, filenameAssetFamilyAssets));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error({ moduleName, methodName, err });
    }
  }

  let assetFamilies: AssetFamily[];
  try {
    assetFamilies = await get(apiUrlAssetFamilies());
    logger.debug({ moduleName, methodName, assetFamilies });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (assetFamilies !== null &&
      typeof assetFamilies[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssetFamilies);
    const fileDesc: number = await open(fileName, 'w');
    for (const assetFamily of assetFamilies) {
      await write(fileDesc, Buffer.from(JSON.stringify(assetFamily) + '\n'));
      try {
        await exportAssetFamilyAttributes(assetFamily.code);
      } catch (err) {
        logger.info({ moduleName, methodName, err });
        return err;
      }
      try {
        await exportAssetFamilyAssets(assetFamily.code);
      } catch (err) {
        logger.info({ moduleName, methodName, err });
        return err;
      }
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportAssetFamilyAttributes(assetFamilyCode: string): Promise<any> {
  const methodName: string = 'exportAssetFamilyAttributes';
  logger.info({ moduleName, methodName }, 'Starting...');

  let assetFamilyAttributes: AssetFamilyAttribute[];
  try {
    assetFamilyAttributes = await get(apiUrlAssetFamilyAttributes(assetFamilyCode));
    logger.debug({ moduleName, methodName, assetFamilyAttributes });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (assetFamilyAttributes !== null &&
      typeof assetFamilyAttributes[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssetFamilyAttributes);
    const fileDesc: number = await open(fileName, 'a');
    for (const assetFamilyAttribute of assetFamilyAttributes) {
      if (!(assetFamilyAttribute.delete_asset_family_code)) {
        assetFamilyAttribute.delete_asset_family_code = assetFamilyCode;
      }
      await write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAttribute) + '\n'));
      if (assetFamilyAttribute.type === 'multiple_options' ||
          assetFamilyAttribute.type === 'single_option') {
        try {
          await exportAssetFamilyAttributeOptions(assetFamilyCode, assetFamilyAttribute.code);
        } catch (err) {
          logger.info({ moduleName, methodName, err });
          return err;
        }
      }
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportAssetFamilyAttributeOptions(assetFamilyCode: string,
                                                            attributeCode: string): Promise<any> {
  const methodName: string = 'exportAssetFamilyAttributeOptions';
  logger.info({ moduleName, methodName }, 'Starting...');

  let assetFamilyAttributeOptions: AssetFamilyAttributeOption[] = [];
  try {
    assetFamilyAttributeOptions = await get(apiUrlAssetFamilyAttributeOptions(assetFamilyCode,
                                                                                      attributeCode));
    logger.debug({ moduleName, methodName, assetFamilyAttributeOptions });
  } catch (err) {
    if (err.code && err.code !== 404) {
      logger.info({ moduleName, methodName, err });
      return err;
    }
  }
  if (assetFamilyAttributeOptions !== null &&
      typeof assetFamilyAttributeOptions[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssetFamilyAttributeOptions);
    const fileDesc: number = await open(fileName, 'a');
    for (const assetFamilyAttributeOption of assetFamilyAttributeOptions) {
      if (!(assetFamilyAttributeOption.delete_asset_family_code)) {
        assetFamilyAttributeOption.delete_asset_family_code = assetFamilyCode;
      }
      if (!(assetFamilyAttributeOption.delete_attribute_code)) {
        assetFamilyAttributeOption.delete_attribute_code = attributeCode;
      }
      await write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAttributeOption) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportAssetFamilyAssets(assetFamilyCode: string): Promise<any> {
  const methodName: string = 'exportAssetFamilyAssets';
  logger.info({ moduleName, methodName }, 'Starting...');

  let assetFamilyAssets: AssetFamilyAsset[];
  try {
    assetFamilyAssets = await get(apiUrlAssetFamilyAssets(assetFamilyCode));
    logger.debug({ moduleName, methodName, assetFamilyAssets });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (assetFamilyAssets !== null &&
      typeof assetFamilyAssets[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssetFamilyAssets);
    const fileDesc: number = await open(fileName, 'a');
    for (const assetFamilyAsset of assetFamilyAssets) {
      if (!(assetFamilyAsset.delete_asset_family_code)) {
        assetFamilyAsset.delete_asset_family_code = assetFamilyCode;
      }
      await write(fileDesc, Buffer.from(JSON.stringify(assetFamilyAsset) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

// TODO: export function exportMediaFiles(): Promise<any>
export async function exportProductMediaFiles(code: string = ''): Promise<any> {
  const methodName: string = 'exportProductMediaFiles';
  logger.info({ moduleName, methodName }, 'Starting...');

  let mediaFiles: any[] = [];
  try {
    mediaFiles = await get(apiUrlProductMediaFiles(code));
    logger.debug({ moduleName, methodName, mediaFiles });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (mediaFiles !== null &&
      typeof mediaFiles[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameProductMediaFiles);
    const fileDesc: number = await open(fileName, 'a');
    for (const mediaFile of mediaFiles) {
//      if (!(mediaFile.delete_asset_family_code)) {
//        mediaFile.delete_asset_family_code = assetFamilyCode;
//      }
      await write(fileDesc, Buffer.from(JSON.stringify(mediaFile) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

// TODO: PAM exports
export async function exportAssets(): Promise<any> {
  const methodName: string = 'exportAssets';
  logger.info({ moduleName, methodName }, 'Starting...');

  let assets: Asset[];
  try {
    assets = await get(apiUrlAssets());
    logger.debug({ moduleName, methodName, assets });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (assets !== null &&
      typeof assets[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssets);
    const fileDesc: number = await open(fileName, 'w');
    for (const asset of assets) {
      await write(fileDesc, Buffer.from(JSON.stringify(asset) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

export async function exportAssetCategories(): Promise<any> {
  const methodName: string = 'exportAssetCategories';
  logger.info({ moduleName, methodName }, 'Starting...');

  let assetCategories: AssetCategory[];
  try {
    assetCategories = await get(apiUrlAssetCategories());
    logger.debug({ moduleName, methodName, assetCategories });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (assetCategories !== null &&
      typeof assetCategories[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssetCategories);
    const fileDesc: number = await open(fileName, 'w');
    for (const assetCategory of assetCategories) {
      await write(fileDesc, Buffer.from(JSON.stringify(assetCategory) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

// export async function exportAssetReferenceFiles(): Promise<any> {

export async function exportAssetTags(): Promise<any> {
  const methodName: string = 'exportAssetTags';
  logger.info({ moduleName, methodName }, 'Starting...');

  let assetTags: AssetTag[];
  try {
    assetTags = await get(apiUrlAssetTags());
    logger.debug({ moduleName, methodName, assetTags });
  } catch (err) {
    logger.info({ moduleName, methodName, err });
    return err;
  }
  if (assetTags !== null &&
      typeof assetTags[Symbol.iterator] === 'function') {
    const fileName: string = path.join(exportPath, filenameAssetTags);
    const fileDesc: number = await open(fileName, 'w');
    for (const assetTag of assetTags) {
      await write(fileDesc, Buffer.from(JSON.stringify(assetTag) + '\n'));
    }
    await close(fileDesc);
  }
  return OK;
}

// export async function exportAssetVariationFiles(): Promise<any> {

/******************************************************************************
                     I M P O R T   F U N C T I O N S
******************************************************************************/

export async function importAssociationTypes(): Promise<any> {
  const methodName: string = 'importAssociationTypes';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAssociationTypes);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const associationTypes: AssociationType[] = JSON.parse(`[ ${buffer} ]`);
    const results = await patchVndAkeneoCollection(apiUrlAssociationTypes(), associationTypes);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importAttributes(): Promise<any> {
  const methodName: string = 'importAttributes';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAttributes);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const attributes: any[] = JSON.parse(`[ ${buffer} ]`);
    // pim 6 introduced property group_labels, which doesn't exist in the pim, so delete it.
    for (const attribute of attributes) {
      delete attribute.group_labels;
    }
    const results = await patchVndAkeneoCollection(apiUrlAttributes(), attributes);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importAttributeGroups(): Promise<any> {
  const methodName: string = 'importAttributeGroups';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAttributeGroups);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const attributeGroups: AttributeGroup[] = JSON.parse(`[ ${buffer} ]`);
    // attribute groups point to attributes, and attributes point to attribute groups, so let's unlink attribute groups.
    for (const attributeGroup of attributeGroups) {
      attributeGroup.attributes = [];
    }
    const results = await patchVndAkeneoCollection(apiUrlAttributeGroups(), attributeGroups);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importAttributeOptions(): Promise<any> {
  const methodName: string = 'importAttributeOptions';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAttributeOptions);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const attributeOptions: AttributeOption[] = JSON.parse(`[ ${buffer} ]`);
    attributeOptions.sort((a: any, b: any) => {
      return a.attribute < b.attribute ? -1 :
             a.attribute > b.attribute ? 1 :
             a.code < b.code ? -1 :
             a.code > b.code ? 1 : 0;
    });
    if (attributeOptions.length > 0 &&
        attributeOptions[0].attribute) {
      let attributeCode: string = attributeOptions[0].attribute || '';
      let attributeCodeAttributeOptions: any[] = [];
      for (let i = 0; i < attributeOptions.length; i++) {
        if (attributeCode !== attributeOptions[i].attribute ||
           (i + 1) === attributeOptions.length) {
          const results = await patchVndAkeneoCollection(
            apiUrlAttributeOptions(attributeCode), attributeCodeAttributeOptions);
          logger.debug({ moduleName, methodName, results });
          attributeCode = attributeOptions[i].attribute || '';
          attributeCodeAttributeOptions = [];
        }
        const attributeOption: any = attributeOptions[i];
        attributeCodeAttributeOptions.push(attributeOption);
      }
      if (attributeCodeAttributeOptions.length > 0) {
        const results = await patchVndAkeneoCollection(apiUrlAttributeOptions(attributeCode), attributeCodeAttributeOptions);
        logger.debug({ moduleName, methodName, results });
        if (results.responses &&
            results.responses instanceof Array) {
          for (const response of results.responses) {
            let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importCategories(): Promise<any> {
  const methodName: string = 'importCategories';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameCategories);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const categories: any[] = JSON.parse(`[ ${buffer} ]`);
    // pim 6 added property updated, but it doesn't exist, so delete it.
    for (const category of categories) {
      delete category.updated;
    }
    const results = await patchVndAkeneoCollection(apiUrlCategories(), categories);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importChannels(): Promise<any> {
  const methodName: string = 'importChannels';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameChannels);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const channels: Channel[] = JSON.parse(`[ ${buffer} ]`);
    const results = await patchVndAkeneoCollection(apiUrlChannels(), channels);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importCurrencies(): Promise<any> {
  const methodName: string = 'importCurrencies';
  logger.info({ moduleName, methodName }, 'Starting...');
  logger.error({ moduleName, methodName }, 
    'Akeneo PIM does not support the import of currencies. ' +
    'Currencies are installed by: bin/console pim:installer:db.');

  return OK;
}

export async function importFamilies(): Promise<any> {
  const methodName: string = 'importFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameFamilies);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const families: any[] = JSON.parse(`[ ${buffer} ]`);
    // remove onboarder
    for (const family of families) {
      const attributes: any[] = [];
      for (const attribute of family.attributes || []) {
        if (attribute === 'akeneo_onboarder_supplier') {
          continue;
        } else {
          attributes.push(attribute);
        }
      }
      family.attributes = JSON.parse(JSON.stringify(attributes));
      
      for (const channel in family.attribute_requirements || {}) {
        const attributes: any[] = [];
        for (const attribute of family.attribute_requirements[channel]) {
          if (attribute === 'akeneo_onboarder_supplier') {
            continue;
          } else {
            attributes.push(attribute);
          }
        }
        family.attribute_requirements[channel] = JSON.parse(JSON.stringify(attributes));
      }
    }
    const results = await patchVndAkeneoCollection(apiUrlFamilies(), families);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importFamilyVariants(): Promise<any> {
  const methodName: string = 'importFamilyVariants';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameFamilyVariants);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const familyVariants: any[] = JSON.parse(`[ ${buffer} ]`);

    for (const familyVariant of familyVariants) {
      for (const variantAttributeSet of familyVariant.variant_attribute_sets || []) {
        const attributes: any[] = [];
        for (const attribute of variantAttributeSet.attributes) {
          if (attribute === 'akeneo_onboarder_supplier') {
            continue;
          } else {
            attributes.push(attribute);
          }
        }
        variantAttributeSet.attributes = JSON.parse(JSON.stringify(attributes));
      }
    }
   
    familyVariants.sort((a: any, b: any) => {
      return a.family < b.family ? -1 :
             a.family > b.family ? 1 :
             a.code < b.code ? -1 :
             a.code > b.code ? 1 : 0;
    });
    if (familyVariants.length > 0 &&
        familyVariants[0].family) {
      let familyCode: string = familyVariants[0].family || '';
      let familyCodeFamilyVariants: any[] = [];
      for (let i = 0; i < familyVariants.length; i++) {
        if (familyCode !== familyVariants[i].family ||
           (i + 1) === familyVariants.length) {
          const results = await patchVndAkeneoCollection(apiUrlFamilyVariants(familyCode), familyCodeFamilyVariants);
          logger.debug({ moduleName, methodName, results });
          familyCode = familyVariants[i].family || '';
          familyCodeFamilyVariants = [];
        }
        const familyVariant: any = familyVariants[i];
        delete familyVariant.family;
        familyCodeFamilyVariants.push(familyVariant);
      }
      if (familyCodeFamilyVariants.length > 0) {
        const results = await patchVndAkeneoCollection(apiUrlFamilyVariants(familyCode), familyCodeFamilyVariants);
        logger.debug({ moduleName, methodName, results });
        if (results.responses &&
            results.responses instanceof Array) {
          for (const response of results.responses) {
            let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importLocales(): Promise<any> {
  const methodName: string = 'importCurrencies';
  logger.info({ moduleName, methodName }, 'Starting...');
  logger.error({ moduleName, methodName }, 
    'Akeneo PIM does not support the import of locales. ' +
    'Locales are installed by: bin/console pim:installer:db.');

  return OK;
}

export async function importMeasureFamilies(): Promise<any> {
  const methodName: string = 'importMeasureFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');
  const fileName: string = path.join(exportPath, filenameMeasureFamilies);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const measureFamilies: any[] = JSON.parse(`[ ${buffer} ]`);
    const results = await patch(apiUrlMeasureFamilies(), measureFamilies);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importMeasurementFamilies(): Promise<any> {
  const methodName: string = 'importMeasurementFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');
  const fileName: string = path.join(exportPath, filenameMeasurementFamilies);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const measurementFamilies: any[] = JSON.parse(`[ ${buffer} ]`);
    const results = await patch(apiUrlMeasurementFamilies(), measurementFamilies);
    logger.debug({ moduleName, methodName, results });
    if (results.responses &&
        results.responses instanceof Array) {
      for (const response of results.responses) {
        let message: string = response.code ? `Code: ${response.code}: ` : '';
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
}

export async function importProducts(): Promise<any> {
  const methodName: string = 'importProducts';
  logger.info({ moduleName, methodName }, 'Starting...');

  const responses: any[] = [];
  const patchSize: number = patchLimit * promiseLimit;

  const mediaFilesMap: Map<string, any> = new Map();
  let stats: fs.Stats | null = null;
  try {
    stats = await stat(path.join(exportPath, filenameProductMediaFiles));
    await load(path.join(exportPath, filenameProductMediaFiles), mediaFilesMap, 'fromHref');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.info({ moduleName, methodName, error: inspect(err) }, `Error stating: ${path.join(exportPath, filenameProductMediaFiles)}`);
    }
  }

  const fileName: string = path.join(exportPath, filenameProducts);
  const productsMap: Map<string, any> = new Map();
  await load(fileName, productsMap, 'identifier');
  let count: number = 0;
  let products: any[] = [];
  const limit: number = promiseLimit;

  const productMediaFilesSet: Set<any> = new Set();

  const identifiers: any[] = Array.from(productsMap.keys()).sort();

  for (const identifier of identifiers) {
    const product: any = productsMap.get(identifier);
    const valueAttributes: any = product.values ? product.values : {};
    for (const valueAttribute in valueAttributes) {
      let found: number = 0;
      for (const valueObject of valueAttributes[valueAttribute]) {
        if (valueObject.data &&
            valueObject._links &&
            valueObject._links.download &&
            valueObject._links.download.href) {
          ++found;
          const attribute: string = valueAttribute;
          const locale: string | null = valueObject.locale || null;
          const scope: string | null = valueObject.scope || null;
          const data: string = valueObject.data || '';
          const href: string = valueObject._links.download.href || '';
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
      const productProducts: any[] = [];
      let i: number = 0;
      for (i = 0; i < limit; i++) {
        productProducts[i] = [];
      }
      
      i = 0;
      for (const product of products) {
        productProducts[i].push(product);
        if (i < limit - 1) {
          i++;
        } else {
          i = 0;
        }
        ++count;
      }
      
      const promises: any[] = [];
      for (i = 0; i < limit; i++) {
        promises[i] = patchVndAkeneoCollection(apiUrlProducts(), productProducts[i]);
      }
      const results: any = await Promise.all(promises);
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
    const result: any = await patchVndAkeneoCollection(apiUrlProducts(), products);
    for (const response of result.responses) {
      responses.push(response);
    }
  }

  for (const response of responses) {
    let message: string = response.identifier ? `Identifier: ${response.identifier}: ` : '';
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
    const mediaFile: any = mediaFilesMap.get(productMediaFile.href) || null;
    if (mediaFile) {
      if (!(mediaFile.toHref)) {
        // upload and save the location
        const pathAndFile: any = splitMediaFileData(productMediaFile.data);
        const mediaFilePath: string = path.join(pathAndFile.path, pathAndFile.name);
        delete productMediaFile.data;
        delete productMediaFile.href;
        const stream: fs.ReadStream | null = fs.createReadStream(path.join(exportPath, mediaFilePath));
        if (stream) {
          logger.info({ moduleName, methodName, mediaFilePath });
          let uploadResults: any = null;
          try {
            uploadResults = await postMultipartFormData(apiUrlProductMediaFiles(), stream, productMediaFile);
            logger.info({ moduleName, methodName, code: productMediaFile.code, uploadResults: inspect(uploadResults) });
            const location: string = uploadResults;
            mediaFile.toHref = location;
            mediaFile.toData = location.slice(location.indexOf(apiUrlProductMediaFiles()) + apiUrlProductMediaFiles().length, location.length);
          } catch (err) {
            logger.error({ moduleName, methodName, error: inspect(err) }, `Error uploading ${mediaFilePath}`);
          }
        }
      } else {
        // re-use the previously uploaded location
        let patchResults: any = null;
        try {
          const patch: any = {};
          patch.identifier = productMediaFile.identifier;
          patch.values = {};
          patch.values[productMediaFile.attribute] =
          [ { 
            locale: productMediaFile.locale,
            scope: productMediaFile.scope,
            data: mediaFile.toData
          } ];
          patchResults = await patchVndAkeneoCollection(apiUrlProducts(), [ patch ]);
          logger.debug({ moduleName, methodName, code: patch.code, patchResults: inspect(patchResults) });
          for (const response of patchResults.responses) {
            let message: string = response.identifier ? `Identifier: ${response.identifier}: ` : '';
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
        } catch (err) {
          logger.error({ moduleName, methodName, error: inspect(err) }, `Error patching ${mediaFile}`);
        }
      }
    }
  }

  const mediaFileDesc: number = await open(path.join(exportPath, filenameProductMediaFiles), 'w');
  for (const mediaFile of mediaFilesMap.values()) {
    await write(mediaFileDesc, `${JSON.stringify(mediaFile)}\n`);
  }
  await close(mediaFileDesc);

  return count;
}

export async function importProductModels(): Promise<any> {
  const methodName: string = 'importProductModels';
  logger.info({ moduleName, methodName }, 'Starting...');

  const responses: any[] = [];

  const mediaFilesMap: Map<string, any> = new Map();
  let stats: fs.Stats | null = null;
  try {
    stats = await stat(path.join(exportPath, filenameProductMediaFiles));
    await load(path.join(exportPath, filenameProductMediaFiles), mediaFilesMap, 'fromHref');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.info({ moduleName, methodName, error: inspect(err) }, `Error stating: ${path.join(exportPath, filenameProductMediaFiles)}`);
    }
  }

  const fileName: string = path.join(exportPath, filenameProductModels);
  const productModelsMap: Map<string, any> = new Map();
  await load(fileName, productModelsMap, 'code');
  let count: number = 0;
  let productModels: any[] = [];
  const limit: number = promiseLimit;

  const productModelMediaFilesSet: Set<any> = new Set();

  // sort for precedence
  const parentsMap: Map<string, Set<string>> = new Map();
  for (const productModel of productModelsMap.values()) {
    const parent: string = productModel.parent || '';
    const code: string = productModel.code || '';
    if (!(parentsMap.get(parent))) {
      const codes: Set<string> = new Set();
      codes.add(code);
      parentsMap.set(parent, codes);
    } else {
      const codes: Set<string> = parentsMap.get(parent) || new Set();
      codes.add(code);
    }
  }
  //console.log(inspect(parentsMap));
  const keys: any[] = [];
  function walk(parent: string, depth: number) {
    //console.log(`${parent}, ${depth}`);
    const codes: Set<string> = parentsMap.get(parent) || new Set();
    const level: number = depth + 1;
    if (codes.size > 0) {
      for (const code of codes.values()) {
        keys.push({ code, level });
        walk(code, level);
      }
    }
  }
  walk('', -1);
  keys.sort((a: any, b: any) => {
    return a.level < b.level ? -1 :
           a.level > b.level ? 1 : 0;
  });

  //console.log(inspect(keys));
  //if (methodName !== 'junk') process.exit();
  for (const key of keys) {
    const productModel: any = productModelsMap.get(key.code);
    const code: string = productModel.code ? productModel.code : '';
    const valueAttributes: any = productModel.values ? productModel.values : {};
    for (const valueAttribute in valueAttributes) {
      let found: number = 0;
      for (const valueObject of valueAttributes[valueAttribute]) {
        if (valueObject.data &&
            valueObject._links &&
            valueObject._links.download &&
            valueObject._links.download.href) {
          ++found;
          const attribute: string = valueAttribute;
          const locale: string | null = valueObject.locale || null;
          const scope: string | null = valueObject.scope || null;
          const data: string = valueObject.data || '';
          const href: string = valueObject._links.download.href || '';
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
      const productModelProductModels: any[] = [];
      let i: number = 0;
      for (i = 0; i < limit; i++) {
        productModelProductModels[i] = [];
      }
      
      i = 0;
      for (const productModel of productModels) {
        productModelProductModels[i].push(productModel);
        if (i < limit - 1) {
          i++;
        } else {
          i = 0;
        }
        ++count;
      }
      
      const promises: any[] = [];
      for (i = 0; i < limit; i++) {
        promises[i] = patchVndAkeneoCollection(apiUrlProductModels(), productModelProductModels[i]);
      }
      const results: any = await Promise.all(promises);
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
    const result: any = await patchVndAkeneoCollection(apiUrlProductModels(), productModels);
    for (const response of result.responses) {
      responses.push(response);
    }
  }

  for (const response of responses) {
    let message: string = response.code ? `Code: ${response.code}: ` : '';
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
    const mediaFile: any = mediaFilesMap.get(productModelMediaFile.href) || null;
    if (mediaFile) {
      if (!(mediaFile.toHref)) {
        // upload and save the location
        const pathAndFile: any = splitMediaFileData(productModelMediaFile.data);
        const mediaFilePath: string = path.join(pathAndFile.path, pathAndFile.name);
        delete productModelMediaFile.data;
        delete productModelMediaFile.href;
        const stream: fs.ReadStream | null = fs.createReadStream(path.join(exportPath, mediaFilePath));
        if (stream) {
          logger.info({ moduleName, methodName, mediaFilePath });
          let uploadResults: any = null;
          try {
            uploadResults = await postMultipartFormData(apiUrlProductMediaFiles(), stream, productModelMediaFile);
            logger.info({ moduleName, methodName, code: productModelMediaFile.code, uploadResults: inspect(uploadResults) });
            const location: string = uploadResults;
            mediaFile.toHref = location;
            mediaFile.toData = location.slice(location.indexOf(apiUrlProductMediaFiles()) + apiUrlProductMediaFiles().length, location.length);
          } catch (err) {
            logger.error({ moduleName, methodName, error: inspect(err) }, `Error uploading ${mediaFilePath}`);
          }
        }
      } else {
        // re-use the previously uploaded location
        let patchResults: any = null;
        try {
          const patch: any = {};
          patch.code = productModelMediaFile.code;
          patch.values = {};
          patch.values[productModelMediaFile.attribute] =
          [ { 
            locale: productModelMediaFile.locale,
            scope: productModelMediaFile.scope,
            data: mediaFile.toData
          } ];
          patchResults = await patchVndAkeneoCollection(apiUrlProductModels(), [ patch ]);
          logger.debug({ moduleName, methodName, code: patch.code, patchResults: inspect(patchResults) });
          for (const response of patchResults.responses) {
            let message: string = response.code ? `Code: ${response.code}: ` : '';
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
        } catch (err) {
          logger.error({ moduleName, methodName, error: inspect(err) }, `Error patching ${mediaFile}`);
        }
      }
    }
  }

  const mediaFileDesc: number = await open(path.join(exportPath, filenameProductMediaFiles), 'w');
  for (const mediaFile of mediaFilesMap.values()) {
    await write(mediaFileDesc, `${JSON.stringify(mediaFile)}\n`);
  }
  await close(mediaFileDesc);

  return count;
}

/******************** R E F E R E N C E   E N T I T I E S ********************/

export async function importReferenceEntities(): Promise<any> {
  const methodName: string = 'importReferenceEntities';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameReferenceEntities);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const referenceEntities: ReferenceEntity[] = JSON.parse(`[ ${buffer} ]`);
    for (const referenceEntity of referenceEntities) {
      const results = await patch(`${apiUrlReferenceEntities(referenceEntity.code)}`, referenceEntity);
      // logger.info({ moduleName, methodName, results });
    }
  }
  return OK;
}

export async function importReferenceEntityAttributes(): Promise<any> {
  const methodName: string = 'importReferenceEntityAttributes';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameReferenceEntityAttributes);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const referenceEntityAttributes: any[] = JSON.parse(`[ ${buffer} ]`);
    for (const referenceEntityAttribute of referenceEntityAttributes) {
      const referenceEntityCode: string = referenceEntityAttribute.delete_reference_entity_code || '';
      delete referenceEntityAttribute.delete_reference_entity_code;
      delete referenceEntityAttribute._links;
      let inCount: number = 0;
      for (const label in referenceEntityAttribute.labels) {
        ++inCount;
      }
      if (!(inCount)) {
        referenceEntityAttribute.labels['en_US'] = `[${referenceEntityAttribute.code}]`;
      }
      const results = await patch(
        `${apiUrlReferenceEntityAttributes(referenceEntityCode)}/${referenceEntityAttribute.code}`,
        referenceEntityAttribute);
      // logger.info({ moduleName, methodName, results });
    }
  }
  return OK;
}

export async function importReferenceEntityAttributeOptions(): Promise<any> {
  const methodName: string = 'importReferenceEntityAttributeOptions';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameReferenceEntityAttributeOptions);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const referenceEntityAttributeOptions: ReferenceEntityAttributeOption[] = JSON.parse(`[ ${buffer} ]`);
    for (const referenceEntityAttributeOption of referenceEntityAttributeOptions) {
      const referenceEntityCode: string = referenceEntityAttributeOption.delete_reference_entity_code || '';
      const attributeCode: string = referenceEntityAttributeOption.delete_attribute_code || '';
      delete referenceEntityAttributeOption.delete_reference_entity_code;
      delete referenceEntityAttributeOption.delete_attribute_code;
      const results = await patch(
        `${apiUrlReferenceEntityAttributeOptions(referenceEntityCode, attributeCode)}` +
        `/${referenceEntityAttributeOption.code}`,
        referenceEntityAttributeOption);
      // logger.info({ moduleName, methodName, results });
    }
  }
  return OK;
}

export async function importReferenceEntityRecords(): Promise<any> {
  const methodName: string = 'importReferenceEntityRecords';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameReferenceEntityRecords);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const referenceEntityRecords: any[] = JSON.parse(`[ ${buffer} ]`);
    if (referenceEntityRecords.length > 0) {
      let referenceEntityData: any[] = [];
      let referenceEntityCode: string = referenceEntityRecords[0].delete_reference_entity_code || '';
      let count: number = 0;
      for (let i = 0; i < referenceEntityRecords.length; i++) {
        if (referenceEntityCode !== referenceEntityRecords[i].delete_reference_entity_code ||
            (count > 0 && count % patchLimit === 0) ||
            (i + 1) === referenceEntityRecords.length) {
          const results = await patch(`${apiUrlReferenceEntityRecords(referenceEntityCode)}`,
                                      referenceEntityData);
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
}

export async function importReferenceEntityMediaFiles(referenceEntityCode: string, data: any[]): Promise<any[]> {
  const methodName: string = 'importReferenceEntityMediaFiles';
  logger.info({ moduleName, methodName }, `Starting...`);

  const dirs: any[] = exportPath.split(path.sep);
  dirs.push(referenceEntityCode);
  let dirPath: string = '';
  for (const dir of dirs) {
    if (dir !== '.') {
      dirPath += path.sep;
      dirPath += dir;
      try {
        fs.mkdirSync(dirPath);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
    } else {
      dirPath += dir;    
    }
  }
  
  const results: any = {};
  let referenceEntityMediaFileCode: string = '';
  for (const datum of data) {
    const code: string = datum.code;
    try {
      const stream: any = fs.createReadStream(`${dirPath}${path.sep}${code}.png`);
      referenceEntityMediaFileCode = await postMultipartFormData(
        apiUrlReferenceEntityMediaFiles(),
        stream);
        
      const result: any = {
        referenceEntityCode,
        referenceEntityMediaFileCode
      };
      
      results[code] = result;
    } catch (err) {
      logger.error({ moduleName, methodName, err }, `loading ${code}.png`);
      process.exit(99);
    }
  }
  const handle: any = await open(`${dirPath}${path.sep}referenceEntityMediaFilesMap.txt`, 'a');
  for (const result of results) {
    await write(handle, `${JSON.stringify(result).toString()}\n`);
  }
  await close(handle);
  
  return results;
} 

/******************** A S S E T   F A M I L I E S ********************/

export async function importAssetFamilies(): Promise<any> {
  const methodName: string = 'importAssetFamilies';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAssetFamilies);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const assetFamilies: AssetFamily[] = JSON.parse(`[ ${buffer} ]`);
    for (const assetFamily of assetFamilies) {
      delete assetFamily.attribute_as_main_media;
      const results = await patch(`${apiUrlAssetFamilies()}/${assetFamily.code}`, assetFamily);
      // logger.info({ moduleName, methodName, results });
    }
  }
  return OK;
}

export async function importAssetFamilyAttributes(): Promise<any> {
  const methodName: string = 'importAssetFamilyAttributes';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAssetFamilyAttributes);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const assetFamilyAttributes: any[] = JSON.parse(`[ ${buffer} ]`);
    for (const assetFamilyAttribute of assetFamilyAttributes) {
      const assetFamilyCode: string = assetFamilyAttribute.delete_asset_family_code || '';
      delete assetFamilyAttribute.delete_asset_family_code;
      delete assetFamilyAttribute._links;
      const results = await patch(
        `${apiUrlAssetFamilyAttributes(assetFamilyCode)}/${assetFamilyAttribute.code}`,
        assetFamilyAttribute);
      // logger.info({ moduleName, methodName, results });
    }
  }
  return OK;
}

export async function importAssetFamilyAttributeOptions(): Promise<any> {
  const methodName: string = 'importAssetFamilyAttributeOptions';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAssetFamilyAttributeOptions);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const assetFamilyAttributeOptions: AssetFamilyAttributeOption[] = JSON.parse(`[ ${buffer} ]`);
    for (const assetFamilyAttributeOption of assetFamilyAttributeOptions) {
      const assetFamilyCode: string = assetFamilyAttributeOption.delete_asset_family_code || '';
      const attributeCode: string = assetFamilyAttributeOption.delete_attribute_code || '';
      delete assetFamilyAttributeOption.delete_asset_family_code;
      delete assetFamilyAttributeOption.delete_attribute_code;
      const results = await patch(
        `${apiUrlAssetFamilyAttributeOptions(assetFamilyCode, attributeCode)}` +
        `/${assetFamilyAttributeOption.code}`,
        assetFamilyAttributeOption);
      // logger.info({ moduleName, methodName, results });
    }
  }
  return OK;
}

export async function importAssetFamilyAssets(): Promise<any> {
  const methodName: string = 'importAssetFamilyAssets';
  logger.info({ moduleName, methodName }, 'Starting...');

  const fileName: string = path.join(exportPath, filenameAssetFamilyAssets);
  const fileDesc: number = await open(fileName, 'r');
  const buffer: string = (await read(fileDesc)).toString().replace(/\n/gi, ', ').slice(0, -2);
  await close(fileDesc);
  if (buffer.length > 0) {
    const assetFamilyAssets: any[] = JSON.parse(`[ ${buffer} ]`);
    if (assetFamilyAssets.length > 0) {
      let assetFamilyData: any[] = [];
      let assetFamilyCode: string = assetFamilyAssets[0].delete_asset_family_code || '';
      let count: number = 0;
      for (let i = 0; i < assetFamilyAssets.length; i++) {
        if (assetFamilyCode !== assetFamilyAssets[i].delete_asset_family_code ||
            (count > 0 && count % patchLimit === 0) ||
            (i + 1) === assetFamilyAssets.length) {
          const results = await patch(`${apiUrlAssetFamilyAssets(assetFamilyCode)}`,
                                      assetFamilyData);
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
}

export async function importAssetFamilyMediaFiles(assetFamilyCode: string, data: any[]): Promise<any[]> {
  const methodName: string = 'importAssetFamilyMediaFiles';
  logger.info({ moduleName, methodName }, `Starting...`);

  const dirs: any[] = exportPath.split(path.sep);
  dirs.push(assetFamilyCode);
  let dirPath: string = '';
  for (const dir of dirs) {
    if (dir !== '.') {
      dirPath += path.sep;
      dirPath += dir;
      try {
        fs.mkdirSync(dirPath);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
    } else {
      dirPath += dir;    
    }
  }
  
  const results: any = {};
  let assetFamiliesMediaFileCode: string = '';
  for (const datum of data) {
    const code: string = datum.code;
    try {
      const stream: any = fs.createReadStream(`${dirPath}${path.sep}${code}.png`);
      assetFamiliesMediaFileCode = await postMultipartFormData(
        apiUrlReferenceEntityMediaFiles(),
        stream);
        
      const result: any = {
        assetFamilyCode,
        assetFamiliesMediaFileCode
      };
      
      results[code] = result;
    } catch (err) {
      logger.error({ moduleName, methodName, err }, `loading ${code}.png`);
      process.exit(99);
    }
  }
  const handle: any = await open(`${dirPath}${path.sep}assetFamilyMediaFilesMap.txt`, 'a');
  for (const result of results) {
    await write(handle, `${JSON.stringify(result).toString()}\n`);
  }
  await close(handle);
  
  return results;
} 

// TODO: PAM imports
// export async function importAssets(): Promise<any> {
// export async function importAssetCategories(): Promise<any> {
// export async function importAssetReferenceFiles(): Promise<any> {
// export async function importAssetTags(): Promise<any> {
// export async function importAssetVariationFiles(): Promise<any> {

// A main method with no command line parameter management
async function main(...args: string[]): Promise<any> {
  const methodName: string = 'main';
  const loggerLevel: any = (process.env.LOG_LEVEL as string) || 'info';
  logger.level(loggerLevel);
  const started: Date = new Date(); 
  logger.info({ moduleName, methodName, started },` Starting...`);

  const cla: any = argz(args);
  const tasks: any = cla.tasks;

  let results: any = [];

  results = (tasks.importAssociationTypes) ? await importAssociationTypes() : [];
  results = (tasks.importAttributes) ? await importAttributes() : [];
  results = (tasks.importAttributeGroups) ? await importAttributeGroups() : [];
  results = (tasks.importAttributeOptions) ? await importAttributeOptions() : [];
  results = (tasks.importCategories) ? await importCategories() : [];
  results = (tasks.importChannels) ? await importChannels() : [];
  // results = (tasks.importCurrencies) ? await importCurrencies() : []; // Not Supported by API
  results = (tasks.importFamilies) ? await importFamilies() : [];
  results = (tasks.importFamilyVariants) ? await importFamilyVariants() : [];
//  results = (tasks.importGroups) ? await importGroups() : [];
  // results = (tasks.importLocales) ? await importLocales() : []; // Not Supported by API
  results = (tasks.importMeasureFamilies) ? await importMeasureFamilies() : [];
  results = (tasks.importMeasurementFamilies) ? await importMeasurementFamilies() : [];
  results = (tasks.importProducts) ? await importProducts() : [];
  results = (tasks.importProductModels) ? await importProductModels() : [];
  results = (tasks.importReferenceEntities) ? await importReferenceEntities() : [];
  results = (tasks.importReferenceEntityAttributes) ? await importReferenceEntityAttributes() : [];
  results = (tasks.importReferenceEntityAttributeOptions) ? await importReferenceEntityAttributeOptions() : [];
  results = (tasks.importReferenceEntityRecords) ? await importReferenceEntityRecords() : [];
  results = (tasks.importAssetFamilies) ? await importAssetFamilies() : [];
  results = (tasks.importAssetFamilyAttributes) ? await importAssetFamilyAttributes() : [];
  results = (tasks.importAssetFamilyAttributeOptions) ? await importAssetFamilyAttributeOptions() : [];
  results = (tasks.importAssetFamilyAssets) ? await importAssetFamilyAssets() : [];
  // TODO: results = (tasks.importAssets) ? await importAssets() : [];
  // TODO: results = (tasks.importAssetCategories) ? await importAssetCategories() : [];
  // TODO: results = (tasks.importAssetReferenceFiles) ? await importAssetReferenceFiles() : [];
  // TODO: results = (tasks.importAssetTags) ? await importAssetTags() : [];
  // TODO: results = (tasks.importAssetVariationFiles) ? await importAssetVariationFiles() : [];
  results = (tasks.exportAssociationTypes) ? await exportAssociationTypes() : [];
  results = (tasks.exportAttributes) ? await exportAttributes() : [];
  results = (tasks.exportAttributeGroups) ? await exportAttributeGroups() : [];
  results = (tasks.exportAttributeOptions) ? await exportAttributeOptions(cla.parameter) : [];
  results = (tasks.exportCategories) ? await exportCategories() : [];
  results = (tasks.exportChannels) ? await exportChannels() : [];
  results = (tasks.exportCurrencies) ? await exportCurrencies() : [];
  results = (tasks.exportFamilies) ? await exportFamilies() : [];
  results = (tasks.exportFamilyVariants) ? await exportFamilyVariants(cla.parameter) : [];
  results = (tasks.exportGroups) ? await exportGroups() : [];
  results = (tasks.exportLocales) ? await exportLocales() : [];
  results = (tasks.exportMeasureFamilies) ? await exportMeasureFamilies() : [];
  results = (tasks.exportMeasurementFamilies) ? await exportMeasurementFamilies() : [];
  results = (tasks.exportProducts) ? await exportProducts(cla.parameter) : [];
  results = (tasks.exportProductModels) ? await exportProductModels() : [];
  // TODO: results = (tasks.exportPublishedProduct) ? await exportPublishedProduct() : [];
  // TODO: results = (tasks.exportProductMediaFile) ? await exportProductMediaFile() : [];
  results = (tasks.exportReferenceEntities) ? await exportReferenceEntities() : [];
  results = (tasks.exportReferenceEntityAttributes) ? await exportReferenceEntityAttributes(cla.parameter) : [];
  // this requires more than one parameter
  // results = (tasks.exportReferenceEntityAttributeOptions) ? await exportReferenceEntityAttributeOptions(cla.parameter) : [];
  results = (tasks.exportReferenceEntityRecords) ? await exportReferenceEntityRecords(cla.parameter) : [];
  // TODO: results = (tasks.exportReferenceEntityMediaFile) ? await exportReferenceEntityMediaFile() : [];
  results = (tasks.exportAssets) ? await exportAssets() : [];
  results = (tasks.exportAssetCategories) ? await exportAssetCategories() : [];
  results = (tasks.exportProductMediaFiles) ? await exportProductMediaFiles() : [];
  // TODO: results = (tasks.exportAssetReferenceFiles) ? await exportAssetReferenceFiles() : [];
  results = (tasks.exportAssetTags) ? await exportAssetTags() : [];
  // TODO: results = (tasks.exportAssetVariationFiles) ? await exportAssetVariationFiles() : [];
  results = (tasks.exportAssetFamilies) ? await exportAssetFamilies() : [];

  const stopped: Date = new Date();
  const duration: string = ((stopped.getTime() - started.getTime()) / 1000).toLocaleString('en-US');
  const heapUsed: string = process.memoryUsage().heapUsed.toLocaleString('en-US');
  logger.info({ moduleName, methodName, heapUsed, started, stopped, duration },`in seconds`);
}

// Start the program
if (require.main === module) {
  main();
}
