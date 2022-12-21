#!/bin/bash

export LOG_LEVEL=info
export AKENEO_EXPORT_PATH=data
mkdir -p $AKENEO_EXPORT_PATH

#
# From
#

export AKENEO_BASE_URL="http://localhost:8081"
export AKENEO_CLIENT_ID=5_6cyzd9ybuog8wo8kcwggw80s84kgkk8co4g4008w0kkc0c08wg
export AKENEO_PASSWORD=746369602
export AKENEO_SECRET=5fcde1b0ogkc4ckogowwok4ogwk84ws888c4koc48k8sw04wks
export AKENEO_USERNAME=pim_1_7883

node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportAssociationTypes
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportAttributeGroups
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportAttributes
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportCategories
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportChannels
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportCurrencies
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportFamilies
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportLocales
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportMeasureFamilies
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportProducts
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t exportProductModels

#
# To
#

export AKENEO_BASE_URL="http://localhost:8082"
export AKENEO_CLIENT_ID=1_55sndfrcci4oowswcscsks0k8g0o0wsosw4ck8wkggk4ocowc4
export AKENEO_PASSWORD=3ca2b1560
export AKENEO_SECRET=2lynmtfmhreokk8kocoowc880kcw8g8swok0888c8swccs84k8
export AKENEO_USERNAME=pim_2_4641

node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importChannels
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importAssociationTypes
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importAttributeGroups
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importAttributes
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importAttributeOptions
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importCategories
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importFamilies
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importFamilyVariants
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importProductModels
node --max-old-space-size=16384 --unhandled-rejections=strict src/index -t importProducts
