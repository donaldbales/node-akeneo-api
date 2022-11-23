# node-akeneo-api

A NodeJS module that supports the use of Akeneo PIM's Web API

## Release

This module supports Akeneo PIM Web API for Akeneo PIM 3.2 through 6.0+. It has been in use since 2019 in the node-akeneo integration framework: [https://github.com/donaldbales/node-akeneo](url)

1.6.0 - [https://api.akeneo.com/api-reference-60.html](url)

## Installation

Using npm:

```
$ npm i --save node-akeneo-api
```

## Configuration

### Environment Variables

You need to set these environment variables:

```
AKENEO_BASE_URL default 'http://akeneo-pimee.local:8080'
AKENEO_CLIENT_ID
AKENEO_EXPORT_PATH default '.'
AKENEO_PASSWORD
AKENEO_PATCH_LIMIT default 100
AKENEO_PROMISE_LIMIT default 16
AKENEO_SECRET
AKENEO_TOKEN_URL default '/api/oauth/v1/token'
AKENEO_USERNAME
LOG_LEVEL default 'info'
```

Client ID, Secret, Username, and Password are supplied in Akeneo PIM Connections screen after you create a connection.

When you set the LOG_LEVEL to debug, in addition to more logging detail, the HTTP methods save their raw responses to a file named after the method.

## Getting Started

Here's the corresponding Akeneo PIM Web API documentation: [https://api.akeneo.com/api-reference-60.html](url).

```
import * as akeneo from 'node-akeneo-api';

let results: any[] = [];
try {
  // get products updated after 2022-01-01
  results = await akeneo.get(
    `${akeneo.apiUrlProducts()}?pagination_type=search_after` +
    `&search={"updated":[{"operator":">","value":"2022-01-01 00:00:00"}]}`);
} catch (err) {
  // handle any errors...
}
```

I suggest you examine the export and import functions in the source code for examples: [https://github.com/donaldbales/node-akeneo-api](url).

I also suggest you run each export function so you have data files with samples of the formatted JSON for each Akeneo PIM entity.

## Documentation

This modufle was written in Typescript, so all my documentation and examples are in Typescript too.  By default, node-akeneo-api uses Bunyan for a logger.

### Constants
These exported constants may be used in an Javascript objects you create.

```
// Catalog
export const AKENEO_CATEGORIES: string                  = 'categories';
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
export const PIM_CATALOG_TABLE: string                  = 'pim_catalog_table'; // (EE only)
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
  PIM_CATALOG_IDENTIFIER, // there can be only one identifier
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

// Reference Entities (only avaialable in the enterprise edition) 
export const REFERENCE_ENTITY_IMAGE: string            = 'image';
export const REFERENCE_ENTITY_MULTIPLE_OPTIONS: string = 'multiple_options';
export const REFERENCE_ENTITY_NUMBER: string           = 'number';
export const REFERENCE_ENTITY_MULTIPLE_LINKS: string   = 'reference_entity_multiple_links';
export const REFERENCE_ENTITY_SINGLE_LINK: string      = 'reference_entity_single_link';
export const REFERENCE_ENTITY_SINGLE_OPTION: string    = 'single_option';
export const REFERENCE_ENTITY_TEXT: string             = 'text';
// Yes, I know, there isn't a textarea type, it's text + textarea boolean, but I need to differentiate
export const REFERENCE_ENTITY_TEXTAREA: string         = 'textarea';

// Asset Families (only avaialable in the enterprise edition) 
export const ASSET_FAMILY_MEDIA_FILE: string           = 'media_file';
export const ASSET_FAMILY_MEDIA_LINK: string           = 'media_link';
export const ASSET_FAMILY_MULTIPLE_OPTIONS: string     = 'multiple_options';
export const ASSET_FAMILY_NUMBER: string               = 'number';
export const ASSET_FAMILY_SINGLE_OPTION: string        = 'single_option';
export const ASSET_FAMILY_TEXT: string                 = 'text';
// Yes, I know, there isn't a textarea type, it's text + textarea boolean, but I need to differentiate
export const ASSET_FAMILY_TEXTAREA: string             = 'textarea'
```

### Variables

These exported variables are used as default values for filenames in the utility export and import functions. You can override their values.

```
// Catalog
export let filenameAssociationTypes: string                = 'associationTypes.vac';
export let filenameAttributes: string                      = 'attributes.vac';
export let filenameAttributeGroups: string                 = 'attributeGroups.vac';
export let filenameAttributeOptions: string                = 'attributeOptions.vac';
export let filenameCategories: string                      = 'categories.vac';
export let filenameChannels: string                        = 'channels.vac';
export let filenameCurrencies: string                      = 'currencies.vac';
export let filenameFamilies: string                        = 'families.vac';
export let filenameFamilyVariants: string                  = 'familyVariants.vac';
export let filenameLocales: string                         = 'locales.vac';
export let filenameMeasureFamilies: string                 = 'measureFamilies.vac';
export let filenameProducts: string                        = 'products.vac';
export let filenameProductModels: string                   = 'productModels.vac';

// Reference Entities (only avaialable in the enterprise edition) 
export let filenameReferenceEntities: string               = 'referenceEntities.vac';
export let filenameReferenceEntityAttributes: string       = 'referenceEntityAttributes.vac';
export let filenameReferenceEntityAttributeOptions: string = 'referenceEntityAttributeOptions.vac';
export let filenameReferenceEntityRecords: string          = 'referenceEntityRecords.vac';

// Asset Families (only avaialable in the enterprise edition) 
export let filenameAssetFamilies: string                   = 'assetFamilies.vac';
export let filenameAssetFamilyAttributes: string           = 'assetFamilyAttributes.vac';
export let filenameAssetFamilyAttributeOptions: string     = 'assetFamilyAttributeOptions.vac';
export let filenameAssetFamilyAssets: string               = 'assetFamilyAssets.vac';

// v3 PAM
export let filenameAssets: string                          = 'assets.vac';
export let filenameAssetCategories: string                 = 'assetCategories.vac';
export let filenameAssetReferenceFiles: string             = 'assetReferenceFiles.vac';
export let filenameAssetTags: string                       = 'assetTags.vac';
export let filenameAssetVariationFiles: string             = 'assetVariationFiles.vac';
// end of v3
```

### Help Functions

```
// File System
// util.promisify()'d versions of callback type functions
// see: https://nodejs.org/docs/latest-v12.x/api/fs.html
export function close(fileDescriptor: number): Promise<any>;
export function open(path: string, flags: string): Promise<number>;
export function read(path: string): Promise<Buffer>;
export function unlink(path: string): Promise<any>;
export function write(fileDescriptor: number, buffer: Buffer): Promise<any>;

// Codifiers
// These utility functions take a GUID or Label and turn them into 
// valid ASCII code value for use in Akeneo PIM Catalog objects
export function assetCode(name: string): string;
export function attributeCode(name: string): string;
export function attributeLabel(property: string): string;
export function fileCode(name: string): string;
export function referenceEntityCode(name: string): string;
export function urlCode(name: string): string;

// Remove enclosing double quoutes from a label
export function deQuote(property: string): string;

// Given an array of directory names, create the tree on the file system
export function mkdirs(dirParts: string[]): string;

// API URLs
// If pass in the last optional parameter these return a URL for: GET, or POST, one object
// otherwise these return a URL for: GET, or PATCH all objects

// Catalog API URLs
export function apiUrlAssociationTypes(code: string = ''): string;

export function apiUrlAttributes(code: string = ''): string;
export function apiUrlAttributeGroups(code: string = ''): string;
export function apiUrlAttributeOptions(attributeCode: string, code: string = ''): string;

export function apiUrlCategories(code: string = ''): string

export function apiUrlFamilies(code: string = ''): string;
export function apiUrlFamilyVariants(familyCode: string, code: string = ''): string;

// Product API URLs
export function apiUrlProducts(identifier: string = ''): string;
export function apiUrlProductMediaFiles(code: string = ''): string;
export function apiUrlProductModels(code: string = ''): string;
export function apiUrlPublishedProducts(code: string = ''): string;

// Target Market URLs
export function apiUrlChannels(code: string = ''): string;
export function apiUrlCurrencies(code: string = ''): string;
export function apiUrlLocales(code: string = ''): string;
export function apiUrlMeasureFamilies(code: string = ''): string;
export function apiUrlMeasurementFamilies(): string;

// Reference Entities (only avaialable in the enterprise edition) 
export function apiUrlReferenceEntities(
  referenceEntityCode: string = ''): string;

export function apiUrlReferenceEntityAttributes(
  referenceEntityCode: string,
  referenceEntityAttributeCode: string = ''): string;

export function apiUrlReferenceEntityAttributeOptions(
  referenceEntityCode: string,
  referenceEntityAttributeCode: string,
  referenceEntityAttributeOptionCode: string = ''): string;

export function apiUrlReferenceEntityRecords(
  referenceEntityCode: string, 
  referenceEntityRecordCode: string = ''): string;

export function apiUrlReferenceEntityMediaFiles(
  referenceEntityMediaFileCode: string = ''): string;

// Asset Families (only avaialable in the enterprise edition) 
export function apiUrlAssetFamilies(
  assetFamilyCode: string = ''): string;

export function apiUrlAssetFamilyAttributes(
  assetFamilyCode: string,
  assetFamilyAttributeCode: string = ''): string;

export function apiUrlAssetFamilyAttributeOptions(
  assetFamilyCode: string,
  assetFamilyAttributeCode: string,
  assetFamilyAttributeOptionCode: string = ''): string;

export function apiUrlAssetFamilyMediaFiles(
  assetFamilyAssetCode: string = ''): string;

export function apiUrlAssetFamilyAssets(
  assetFamilyCode: string,
  assetFamilyAssetCode: string = ''): string;

// v3 PAM
export function apiUrlAssets(): string;
export function apiUrlAssetCategories(): string;
export function apiUrlAssetReferenceFiles(assetCode: string, localeCode: string): string;
export function apiUrlAssetTags(): string;
export function apiUrlAssetVariationFiles(assetCode: string, channelCode: string, localeCode: string): string;

// HTTP/HTTPS
// DELETE an object
// This returns the JSON reponse from the Akeneo PIM Web API as an object
// delete is a reserved word
export async function delete_(apiUrl: string, data: any): Promise<any>;

// GET one or more objects
// This returns an array of objects
export async function get(apiUrl: string, callback: any = null): Promise<any>;

// PATCH (update) one object
// This returns the JSON reponse from the Akeneo PIM Web API as an object
export async function patch(apiUrl: string, data: any): Promise<any>;

// PATCH Vendor Akeneo Collection (VAC), aka ndjson 
// Pass in an array of objects, it creates what is now called and newline delimted (nd) JSON
// string in order to batch update objects
// This returns the JSON reponse from the Akeneo PIM Web API as an object
export async function patchVndAkeneoCollection(apiUrl: string, docs: any[]): Promise<any>;

// POST (create) an object
// This returns the JSON reponse from the Akeneo PIM Web API as an object
export async function post(apiUrl: string, data: string): Promise<any>;

// POST (upload) a file
// This returns the JSON reponse from the Akeneo PIM Web API as an object
export async function postMultipartFormData(apiUrl: string, stream: fs.ReadStream): Promise<any>;
```

### Utility Functions

The following functions export entity data from Akeneo PIM saving the data in Vendor Akeneo Collection (vac) aka ndjson files:

```
// Catalog
export async function exportAssociationTypes(): Promise<any>;
export async function exportAttributes(): Promise<any>;
export async function exportAttributeGroups(): Promise<any>;
export async function exportAttributeOptions(attributeCode: string): Promise<any>;
export async function exportCategories(): Promise<any>;
export async function exportChannels(): Promise<any>;
export async function exportCurrencies(): Promise<any>;
export async function exportFamilies(): Promise<any>;
export async function exportFamilyVariants(familyCode: string): Promise<any>;
export async function exportLocales(): Promise<any>;
export async function exportMeasureFamilies(): Promise<any>;
export async function exportProducts(): Promise<any>;
export async function exportProductModels(): Promise<any>;

// Reference Entities (only avaialable in the enterprise edition) 
export async function exportReferenceEntities(): Promise<any>;
export async function exportReferenceEntityAttributeOptions(
  referenceEntityCode: string,
  attributeCode: string): Promise<any>;
export async function exportReferenceEntityAttributes(referenceEntityCode: string): Promise<any>;
export async function exportReferenceEntityRecords(referenceEntityCode: string): Promise<any>;

// Asset Families (only avaialable in the enterprise edition) 
export async function exportAssetFamilies(): Promise<any>;
export async function exportAssetFamilyAssets(assetFamilyCode: string): Promise<any>;
export async function exportAssetFamilyAttributeOptions(
  assetFamilyCode: string,
  attributeCode: string): Promise<any>;
export async function exportAssetFamilyAttributes(assetFamilyCode: string): Promise<any>;

// v3 PAM
export async function exportAssets(): Promise<any>;
export async function exportAssetCategories(): Promise<any>;
export async function exportAssetTags(): Promise<any>;
```

The following functions import entity data saved as vac files into Akeneo PIM:

```
// Catalog
export async function importAssociationTypes(): Promise<any>;
export async function importAttributes(): Promise<any>;
export async function importAttributeGroups(): Promise<any>;
export async function importAttributeOptions(): Promise<any>;
export async function importCategories(): Promise<any>;
export async function importChannels(): Promise<any>;
export async function importCurrencies(): Promise<any>;
export async function importFamilies(): Promise<any>;
export async function importFamilyVariants(): Promise<any>;
export async function importLocales(): Promise<any>;
export async function importMeasureFamilies(): Promise<any>;
export async function importProducts(): Promise<any>;
export async function importProductModels(): Promise<any>;

// Reference Entities (only avaialable in the enterprise edition) 
export async function importReferenceEntities(): Promise<any>;
export async function importReferenceEntityAttributeOptions(): Promise<any>;
export async function importReferenceEntityAttributes(): Promise<any>;
export async function importReferenceEntityMediaFiles(
  referenceEntityCode: string,
  data: any[]): Promise<any[]>;
export async function importReferenceEntityRecords(): Promise<any>;

// Asset Families (only avaialable in the enterprise edition) 
export async function importAssetFamilies(): Promise<any>;
export async function importAssetFamilyAssets(): Promise<any>;
export async function importAssetFamilyAttributeOptions(): Promise<any>;
export async function importAssetFamilyAttributes(): Promise<any>;
export async function importAssetFamilyMediaFiles(
  assetFamilyCode: string,
  data: any[]): Promise<any[]>;
```

## Support

Supports Node versions 12+.

I know full well that some people consider publishing the generated Javascript code for Typescript a bad practice, but not everyone knows Typescript. So yes, I'm bad.

Feel free to email don@donaldbales.com with and complaints, questions, and suggestions.
