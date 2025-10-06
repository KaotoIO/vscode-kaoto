/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CATALOG_VERSION_ID, readUserSetting, setUserSettingsDirectly } from '../Util';
import { assert } from 'chai';

describe('Camel version', function () {
	this.timeout(15000);

	const testDescription = process.env.CAMEL_JBANG_SNAPSHOT_VERSION ? `Set ${process.env.CAMEL_JBANG_SNAPSHOT_VERSION}` : 'Use default';

	it(testDescription, async function () {
		// no env variable set or is empty
		if (
			process.env.CAMEL_JBANG_SNAPSHOT_VERSION === undefined ||
			process.env.CAMEL_JBANG_SNAPSHOT_VERSION === null ||
			process.env.CAMEL_JBANG_SNAPSHOT_VERSION.length === 0
		) {
			this.skip();
		}

		// set version directly
		setUserSettingsDirectly(CATALOG_VERSION_ID, process.env.CAMEL_JBANG_SNAPSHOT_VERSION);
		assert.equal(readUserSetting(CATALOG_VERSION_ID), process.env.CAMEL_JBANG_SNAPSHOT_VERSION);
	});
});
