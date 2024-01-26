'use strict'
/**
 * The script is executed as postinstall (after 'yarn install') and only when some changes were detected
 */
const bm = require('badge-maker')
const fs = require('fs');
const path = require('path');
const pjson = require('../package.json');

const kaotoVersion = pjson.dependencies['@kaoto-next/ui'];
const svgPath = path.join('.', 'images', 'kaoto-ui-version-badge.svg');
const format  = {
    label: 'Kaoto UI',  // (Optional) Badge label
    message: kaotoVersion,  // (Required) Badge message
    color: 'orange',  // (Optional) Message color
    style: 'for-the-badge', // (Optional) One of: 'plastic', 'flat', 'flat-square', 'for-the-badge' or 'social'
}

fs.rmSync(svgPath); // remove previous badge svg
const svg = bm.makeBadge(format); // generate new badge svg using badge-maker
fs.writeFileSync(svgPath, svg); // save generated svg into ./images/
