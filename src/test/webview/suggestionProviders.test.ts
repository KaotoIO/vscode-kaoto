/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { expect } from 'chai';
import { getSuggestions } from '../../helpers/SuggestionRegistry';

suite('Channel API', () => {
	suite('get Suggestions for OS environment variables', function () {
		let originalEnv: NodeJS.ProcessEnv;

		setup(() => {
			originalEnv = { ...process.env };

			// define test environment variables
			process.env.TEST_ALPHA = 'A';
			process.env.TEST_BETA = 'B';
			process.env.TESTCASE = 'C';
			process.env.Test_Case = 'yes';
			process.env.Test_Mixed = 'mixed';
			process.env.PATH = '/usr/local/bin';
		});

		teardown(() => {
			process.env = originalEnv;
		});

		test('includes case-sensitive startsWith matches and ranks them first', async () => {
			const suggestions = await getSuggestions('env', 'TEST_', { propertyName: 'Test', inputValue: '' });
			const values = suggestions.map((s) => s.value);

			expect(values).to.deep.include.members(['TEST_ALPHA', 'TEST_BETA']);
		});

		test('includes case-sensitive and insensitive matches, with case-sensitive ranked first', async () => {
			const suggestions = await getSuggestions('env', 'Te', { propertyName: 'Test', inputValue: '' });
			const values = suggestions.map((s) => s.value);

			expect(values).to.include('Test_Mixed');
			expect(values).to.include('Test_Case');
			expect(values).to.include('TESTCASE');
			expect(values).to.include('TEST_ALPHA');

			expect(values.indexOf('Test_Case')).to.equal(0);
			expect(values.indexOf('Test_Case')).to.be.lessThan(values.indexOf('Test_Mixed'));
			expect(values.indexOf('Test_Case')).to.be.lessThan(values.indexOf('TESTCASE'));
			expect(values.indexOf('Test_Case')).to.be.lessThan(values.indexOf('TEST_ALPHA'));
		});

		test('includes exact match and ranks it high', async () => {
			const suggestions = await getSuggestions('env', 'PATH', { propertyName: 'Test', inputValue: '' });
			const values = suggestions.map((s) => s.value);

			expect(values).to.include('PATH');
			expect(values[0]).to.equal('PATH');
		});

		test('returns empty array for no matches', async () => {
			const suggestions = await getSuggestions('env', 'UNMATCHED_VAR', { propertyName: 'Test', inputValue: '' });
			expect(suggestions).to.be.an('array').that.is.empty;
		});

		test('returns all env variables for empty string input', async () => {
			const suggestions = await getSuggestions('env', '', { propertyName: 'Test', inputValue: '' });
			const expectedKeys = Object.keys(process.env);
			const suggestionValues = suggestions.map((s) => s.value);

			expect(suggestionValues).to.have.members(expectedKeys);
			expect(suggestions).to.have.lengthOf(expectedKeys.length);
		});

		test('ranks case-sensitive startsWith matches before case-insensitive and includes', async () => {
			process.env.PathLib = 'x'; // add a more complex mixed-case match
			process.env.NODEx_PATH = 'y'; // partial match

			const suggestions = await getSuggestions('env', 'Pat', { propertyName: 'Test', inputValue: '' });
			const values = suggestions.map((s) => s.value);

			expect(values.indexOf('PathLib')).to.be.lessThan(values.indexOf('PATH'));
			expect(values.indexOf('PATH')).to.be.lessThan(values.indexOf('NODEx_PATH'));
		});

		test('ranks startsWith (case-insensitive) before includes (case-insensitive)', async () => {
			process.env.MyPath = 'foo'; // startsWith (case-insensitive)
			process.env.FooMyPath = 'bar'; // includes

			const suggestions = await getSuggestions('env', 'myp', { propertyName: 'Test', inputValue: '' });
			const values = suggestions.map((s) => s.value);

			expect(values.indexOf('MyPath')).to.be.lessThan(values.indexOf('FooMyPath'));
		});
	});
});
