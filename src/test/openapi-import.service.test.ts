import type { Get, Rest, RouteDefinition } from '@kaoto/camel-catalog/types';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenApiImportService, OpenApiParseError, OpenApiValidationError } from '../services/openapi-import.service';

suite('OpenApiImportService', function () {
	let service: OpenApiImportService;

	setup(function () {
		service = new OpenApiImportService();
	});

	suite('parseOpenApi - validation', function () {
		test('should throw error for empty string', async function () {
			try {
				await service.parseOpenApi('');
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).to.be.instanceOf(OpenApiValidationError);
				expect((error as Error).message).to.include('OpenAPI specification string cannot be empty');
			}
		});

		test('should throw error for whitespace-only string', async function () {
			try {
				await service.parseOpenApi('   ');
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).to.be.instanceOf(OpenApiValidationError);
			}
		});

		test('should throw error for invalid YAML', async function () {
			const invalidYaml = 'invalid: yaml: content: [unclosed';
			try {
				await service.parseOpenApi(invalidYaml);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).to.be.instanceOf(OpenApiParseError);
			}
		});

		test('should throw error for non-OpenAPI 3.x spec', async function () {
			const swagger2Spec = `
swagger: "2.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      summary: Test
`;
			try {
				await service.parseOpenApi(swagger2Spec);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).to.be.instanceOf(OpenApiValidationError);
				expect((error as Error).message).to.include('only OpenAPI 3.x is supported');
			}
		});

		test('should throw error when paths are missing', async function () {
			const specWithoutPaths = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
`;
			try {
				await service.parseOpenApi(specWithoutPaths);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).to.be.instanceOf(OpenApiValidationError);
				expect((error as Error).message).to.include('missing or invalid paths');
			}
		});

		test('should throw error when paths are empty', async function () {
			const specWithEmptyPaths = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths: {}
`;
			try {
				await service.parseOpenApi(specWithEmptyPaths);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).to.be.instanceOf(OpenApiValidationError);
				expect((error as Error).message).to.include('no paths defined');
			}
		});

		test('should throw error when both generation options are false', async function () {
			const validSpec = createMinimalValidSpec();
			try {
				await service.parseOpenApi(validSpec, {
					shouldGenerateRest: false,
					shouldGenerateRoutes: false,
				});
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).to.be.instanceOf(OpenApiValidationError);
				expect((error as Error).message).to.include('At least one of shouldGenerateRest or shouldGenerateRoutes must be true');
			}
		});
	});

	suite('parseOpenApi - REST generation', function () {
		test('should generate REST definition when shouldGenerateRest is true', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			expect(result).to.have.length(1);
			const restDef = result[0] as Rest;
			expect(restDef.id).to.not.be.undefined;
			expect(restDef.get).to.not.be.undefined;
			expect(restDef.get).to.have.length(1);
		});

		test('should include sourceIdentifier in REST definition', async function () {
			const spec = createMinimalValidSpec();
			const sourceId = 'file:///path/to/openapi.yaml';
			const result = await service.parseOpenApi(spec, {
				shouldGenerateRest: true,
				shouldGenerateRoutes: false,
				sourceIdentifier: sourceId,
			});

			const restDef = result[0] as Rest;
			expect(restDef.openApi?.specification).to.equal(sourceId);
		});

		test('should not include empty sourceIdentifier', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, {
				shouldGenerateRest: true,
				shouldGenerateRoutes: false,
				sourceIdentifier: '   ',
			});

			const restDef = result[0] as Rest;
			expect(restDef.openApi).to.be.undefined;
		});

		test('should generate REST operations for all HTTP methods', async function () {
			const spec = createSpecWithAllMethods();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			expect(restDef.get).to.not.be.undefined;
			expect(restDef.post).to.not.be.undefined;
			expect(restDef.put).to.not.be.undefined;
			expect(restDef.delete).to.not.be.undefined;
			expect(restDef.patch).to.not.be.undefined;
			expect(restDef.head).to.not.be.undefined;
		});

		test('should include operation details in REST definition', async function () {
			const spec = createSpecWithOperationDetails();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			const getOp = restDef.get?.[0];
			expect(getOp?.id).to.equal('getUsers');
			expect(getOp?.path).to.equal('/users');
			expect(getOp?.description).to.equal('Get all users');
			expect(getOp?.routeId).to.equal('route-getUsers');
			expect(getOp?.to).to.equal('direct:getUsers');
		});

		test('should include parameters in REST operation', async function () {
			const spec = createSpecWithParameters();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			const getOp = restDef.get?.[0];
			expect(getOp?.param).to.not.be.undefined;
			expect(getOp?.param?.length).to.be.greaterThan(0);
			expect(getOp?.param?.[0].name).to.equal('limit');
			expect(getOp?.param?.[0].type).to.equal('query');
		});

		test('should include security requirements in REST operation', async function () {
			const spec = createSpecWithSecurity();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			const getOp = restDef.get?.[0];
			expect(getOp?.security).to.not.be.undefined;
			expect(getOp?.security?.length).to.be.greaterThan(0);
		});

		test('should include response messages in REST operation', async function () {
			const spec = createSpecWithResponses();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			const getOp = restDef.get?.[0];
			expect(getOp?.responseMessage).to.not.be.undefined;
			expect(getOp?.responseMessage?.length).to.be.greaterThan(0);
		});

		test('should mark deprecated operations', async function () {
			const spec = createSpecWithDeprecatedOperation();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			const getOp = restDef.get?.[0];
			expect(getOp?.deprecated).to.equal(true);
		});
	});

	suite('parseOpenApi - Route generation', function () {
		test('should generate route definitions when shouldGenerateRoutes is true', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			expect(result.length).to.be.greaterThan(0);
			const routeDef = result[0] as RouteDefinition;
			expect(routeDef.id).to.not.be.undefined;
			expect(routeDef.from).to.not.be.undefined;
		});

		test('should generate route with correct ID pattern', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			const routeDef = result[0] as RouteDefinition;
			expect(routeDef.id).to.match(/^route-/);
		});

		test('should generate route with direct endpoint', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			const routeDef = result[0] as RouteDefinition;
			expect(routeDef.from.uri).to.match(/^direct:/);
		});

		test('should generate route with default implementation', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			const routeDef = result[0] as RouteDefinition;
			expect(routeDef.from.steps).to.not.be.undefined;
			expect(routeDef.from.steps.length).to.be.greaterThan(0);
			const setBodyStep = routeDef.from.steps[0] as any;
			expect(setBodyStep.setBody).to.not.be.undefined;
			expect(setBodyStep.setBody.constant).to.include('not yet implemented');
		});

		test('should generate one route per operation', async function () {
			const spec = createSpecWithMultipleOperations();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			expect(result.length).to.equal(3); // 3 operations
			result.forEach((item) => {
				const routeDef = item as RouteDefinition;
				expect(routeDef.from).to.not.be.undefined;
			});
		});
	});

	suite('parseOpenApi - Combined generation', function () {
		test('should generate both REST and routes when both options are true', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, {
				shouldGenerateRest: true,
				shouldGenerateRoutes: true,
			});

			expect(result.length).to.be.greaterThan(1);
			const restDef = result.find((item) => 'get' in item || 'post' in item);
			const routeDef = result.find((item) => 'from' in item);

			expect(restDef).to.not.be.undefined;
			expect(routeDef).to.not.be.undefined;
		});

		test('should generate REST first, then routes', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, {
				shouldGenerateRest: true,
				shouldGenerateRoutes: true,
			});

			// First item should be REST definition
			expect('get' in result[0] || 'post' in result[0]).to.equal(true);
			// Remaining items should be routes
			for (let i = 1; i < result.length; i++) {
				expect('from' in result[i]).to.equal(true);
			}
		});
	});

	suite('parseOpenApi - Operation ID generation', function () {
		test('should use operationId from spec when available', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			const routeDef = result[0] as RouteDefinition;
			expect(routeDef.id).to.equal('route-getUsers');
		});

		test('should generate operationId when not provided', async function () {
			const spec = createSpecWithoutOperationId();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			const routeDef = result[0] as RouteDefinition;
			expect(routeDef.id).to.match(/^route-get-users$/);
		});

		test('should sanitize path in generated operationId', async function () {
			const spec = createSpecWithComplexPath();
			const result = await service.parseOpenApi(spec, { shouldGenerateRoutes: true });

			const routeDef = result[0] as RouteDefinition;
			expect(routeDef.id).to.match(/^route-get-users-id-posts$/);
		});
	});

	suite('parseOpenApi - Media types', function () {
		test('should extract consumes from request body', async function () {
			const spec = createSpecWithRequestBody();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			const postOp = restDef.post?.[0];
			expect(postOp?.consumes).to.not.be.undefined;
			expect(postOp?.consumes).to.include('application/json');
		});

		test('should extract produces from responses', async function () {
			const spec = createSpecWithResponses();
			const result = await service.parseOpenApi(spec, { shouldGenerateRest: true, shouldGenerateRoutes: false });

			const restDef = result[0] as Rest;
			const getOp = restDef.get?.[0];
			expect(getOp?.produces).to.not.be.undefined;
			expect(getOp?.produces).to.include('application/json');
		});
	});

	suite('parseOpenApi - Default options', function () {
		test('should use default options when not provided', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec);

			// Default: shouldGenerateRoutes = true, shouldGenerateRest = false
			expect(result.length).to.be.greaterThan(0);
			expect('from' in result[0]).to.equal(true);
		});

		test('should not generate REST by default', async function () {
			const spec = createMinimalValidSpec();
			const result = await service.parseOpenApi(spec);

			const hasRest = result.some((item) => 'get' in item || 'post' in item);
			expect(hasRest).to.equal(false);
		});
	});
});

// Helper functions to create test fixtures

function createMinimalValidSpec(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      summary: Get all users
      responses:
        '200':
          description: Success
`;
}

function createSpecWithAllMethods(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        '200':
          description: Success
    post:
      operationId: createUser
      responses:
        '201':
          description: Created
    put:
      operationId: updateUser
      responses:
        '200':
          description: Success
    delete:
      operationId: deleteUser
      responses:
        '204':
          description: No Content
    patch:
      operationId: patchUser
      responses:
        '200':
          description: Success
    head:
      operationId: headUsers
      responses:
        '200':
          description: Success
`;
}

function createSpecWithOperationDetails(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      summary: Get all users
      description: Get all users
      responses:
        '200':
          description: Success
`;
}

function createSpecWithParameters(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - name: limit
          in: query
          description: Maximum number of results
          required: false
          schema:
            type: integer
            default: 10
        - name: offset
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: Success
`;
}

function createSpecWithSecurity(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Success
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
`;
}

function createSpecWithResponses(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
        '404':
          description: Not Found
`;
}

function createSpecWithDeprecatedOperation(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      deprecated: true
      responses:
        '200':
          description: Success
`;
}

function createSpecWithoutOperationId(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get all users
      responses:
        '200':
          description: Success
`;
}

function createSpecWithComplexPath(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users/{id}/posts:
    get:
      summary: Get user posts
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
`;
}

function createSpecWithRequestBody(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        '201':
          description: Created
`;
}

function createSpecWithMultipleOperations(): string {
	return `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        '200':
          description: Success
    post:
      operationId: createUser
      responses:
        '201':
          description: Created
  /posts:
    get:
      operationId: getPosts
      responses:
        '200':
          description: Success
`;
}

suite('OpenAPI $ref Resolution', function () {
	let service: OpenApiImportService;

	setup(function () {
		service = new OpenApiImportService();
	});

	test('should resolve schema references in parameters', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users/{userId}:
    get:
      operationId: getUser
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            $ref: '#/components/schemas/UserId'
      responses:
        '200':
          description: Success
components:
  schemas:
    UserId:
      type: string
      pattern: '^[0-9]+$'
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		expect(rest.get![0].param).to.not.be.undefined;
		expect(rest.get![0].param![0].dataType).to.equal('string');
	});

	test('should resolve schema references in request bodies', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/User'
      responses:
        '201':
          description: Created
components:
  schemas:
    User:
      type: object
      properties:
        name:
          type: string
        email:
          type: string
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.post).to.not.be.undefined;
		expect(rest.post![0].consumes).to.equal('application/json');
	});

	test('should resolve response references', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        '200':
          $ref: '#/components/responses/UserListResponse'
components:
  responses:
    UserListResponse:
      description: List of users
      content:
        application/json:
          schema:
            type: array
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		expect(rest.get![0].responseMessage).to.not.be.undefined;
		expect(rest.get![0].responseMessage![0].message).to.equal('List of users');
	});

	test('should resolve parameter references', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - $ref: '#/components/parameters/LimitParam'
      responses:
        '200':
          description: Success
components:
  parameters:
    LimitParam:
      name: limit
      in: query
      required: false
      schema:
        type: integer
        default: 10
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		expect(rest.get![0].param).to.not.be.undefined;
		expect(rest.get![0].param![0].name).to.equal('limit');
		expect(rest.get![0].param![0].dataType).to.equal('integer');
		expect(rest.get![0].param![0].defaultValue).to.equal('10');
	});

	test('should resolve nested schema references', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      operationId: createUser
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserRequest'
      responses:
        '201':
          description: Created
components:
  schemas:
    UserRequest:
      type: object
      properties:
        profile:
          $ref: '#/components/schemas/Profile'
    Profile:
      type: object
      properties:
        name:
          type: string
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.post).to.not.be.undefined;
		expect(rest.post![0].consumes).to.equal('application/json');
	});

	test('should handle circular references without infinite loops', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /nodes:
    get:
      operationId: getNodes
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Node'
components:
  schemas:
    Node:
      type: object
      properties:
        id:
          type: string
        children:
          type: array
          items:
            $ref: '#/components/schemas/Node'
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		expect(rest.get![0].produces).to.equal('application/json');
	});

	test('should handle missing references gracefully', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - $ref: '#/components/parameters/NonExistent'
      responses:
        '200':
          description: Success
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		// Missing reference should be filtered out
		expect(rest.get![0].param).to.be.undefined;
	});

	test('should not support external references', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - $ref: './external.yaml#/components/parameters/UserId'
      responses:
        '200':
          description: Success
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		// External reference should be filtered out
		expect(rest.get![0].param).to.be.undefined;
	});

	test('should resolve header references in responses', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        '200':
          description: Success
          headers:
            X-Rate-Limit:
              $ref: '#/components/headers/RateLimit'
components:
  headers:
    RateLimit:
      description: Rate limit remaining
      schema:
        type: integer
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		expect(rest.get![0].responseMessage).to.not.be.undefined;
		expect(rest.get![0].responseMessage![0].header).to.not.be.undefined;
		expect(rest.get![0].responseMessage![0].header![0].name).to.equal('X-Rate-Limit');
		expect(rest.get![0].responseMessage![0].header![0].dataType).to.equal('integer');
	});

	test('should handle URI-encoded reference paths', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - $ref: '#/components/parameters/user~1id'
      responses:
        '200':
          description: Success
components:
  parameters:
    user/id:
      name: userId
      in: query
      schema:
        type: string
`;

		const result = await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		expect(result).to.have.length(1);
		const rest = result[0] as Rest;
		expect(rest.get).to.not.be.undefined;
		expect(rest.get![0].param).to.not.be.undefined;
		expect(rest.get![0].param![0].name).to.equal('userId');
	});
});

suite('OpenAPI $ref Logging', function () {
	let service: OpenApiImportService;
	let originalWarn: typeof console.warn;
	let warnCalls: any[][];

	setup(function () {
		service = new OpenApiImportService();
		// Stub console.warn to capture log messages
		originalWarn = console.warn;
		warnCalls = [];
		console.warn = (...args: any[]) => {
			warnCalls.push(args);
		};
	});

	teardown(function () {
		// Restore console.warn
		console.warn = originalWarn;
	});

	test('should log warning for external references', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - $ref: './external.yaml#/components/parameters/UserId'
      responses:
        '200':
          description: Success
`;

		await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		// Verify warning was logged
		expect(warnCalls.length).to.be.greaterThan(0);
		const relevantCall = warnCalls.find((call) => call[0]?.includes('External references are not supported'));
		expect(relevantCall).to.not.be.undefined;
		expect(relevantCall![0]).to.include('./external.yaml#/components/parameters/UserId');
	});

	test('should log warning for missing internal references', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - $ref: '#/components/parameters/NonExistent'
      responses:
        '200':
          description: Success
`;

		await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		// Verify warning was logged
		expect(warnCalls.length).to.be.greaterThan(0);
		const relevantCall = warnCalls.find((call) => call[0]?.includes('Reference resolution failed') || call[0]?.includes('Cannot resolve reference'));
		expect(relevantCall).to.not.be.undefined;
	});

	test('should not log warnings for valid internal references', async function () {
		const spec = `
openapi: "3.0.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      parameters:
        - $ref: '#/components/parameters/LimitParam'
      responses:
        '200':
          description: Success
components:
  parameters:
    LimitParam:
      name: limit
      in: query
      schema:
        type: integer
`;

		await service.parseOpenApi(spec, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: false,
		});

		// Verify no warnings were logged
		expect(warnCalls.length).to.equal(0);
	});
});

suite('Pet Store OpenAPI Integration', function () {
	let service: OpenApiImportService;

	setup(function () {
		service = new OpenApiImportService();
	});

	test('should parse pet-store.openapi.json and generate REST DSL + Routes', async function () {
		// 1. Read the OpenAPI file
		const petStoreJson = await fs.readFile(path.join(__dirname, 'stubs', 'pet-store.openapi.json'), 'utf-8');

		// 2. Parse with both REST and Routes generation
		const result = await service.parseOpenApi(petStoreJson, {
			shouldGenerateRest: true,
			shouldGenerateRoutes: true,
		});

		// 3. Separate REST and Routes
		const restDef = result.find((item) => 'get' in item || 'post' in item) as Rest;
		const routes = result.filter((item) => 'from' in item) as RouteDefinition[];

		// 4. Convert to text representation
		const textRepresentation = generateTextRepresentation(restDef, routes);

		// 5. Validate structure
		expect(restDef).to.not.be.undefined;
		expect(routes).to.have.length.greaterThan(0);

		// 6. Validate specific operations exist
		expect(restDef.get).to.not.be.undefined;
		expect(restDef.post).to.not.be.undefined;
		expect(restDef.put).to.not.be.undefined;
		expect(restDef.delete).to.not.be.undefined;

		// 7. Validate operation counts
		const totalOperations =
			(restDef.get?.length || 0) +
			(restDef.post?.length || 0) +
			(restDef.put?.length || 0) +
			(restDef.delete?.length || 0) +
			(restDef.patch?.length || 0) +
			(restDef.head?.length || 0);

		expect(totalOperations).to.equal(routes.length);

		// 8. Validate specific endpoints
		const getPetById = restDef.get?.find((op: Get) => op.path === '/pet/{petId}');
		expect(getPetById).to.not.be.undefined;
		expect(getPetById?.id).to.equal('getPetById');
		expect(getPetById?.param).to.have.length(1);
		expect(getPetById?.param?.[0].name).to.equal('petId');

		// 9. Log text representation for manual review
		console.log('\n=== Pet Store REST DSL + Routes ===\n');
		console.log(textRepresentation);
		console.log('\n=== End of representation ===\n');
	});
});

function generateTextRepresentation(rest: Rest, routes: RouteDefinition[]): string {
	const lines: string[] = [];

	lines.push('=== REST DSL ===');
	lines.push(`REST ID: ${rest.id}`);

	if (rest.openApi?.specification) {
		lines.push(`OpenAPI Spec: ${rest.openApi.specification}`);
	}

	// Process each HTTP method
	for (const method of ['get', 'post', 'put', 'delete', 'patch', 'head'] as const) {
		const operations = rest[method];
		if (operations && operations.length > 0) {
			lines.push(`\n${method.toUpperCase()}:`);

			for (const op of operations) {
				lines.push(`  - ${op.id} (${op.path})`);

				if (op.description) {
					lines.push(`    Description: ${op.description}`);
				}

				if (op.consumes) {
					lines.push(`    Consumes: ${op.consumes}`);
				}

				if (op.produces) {
					lines.push(`    Produces: ${op.produces}`);
				}

				if (op.param && op.param.length > 0) {
					lines.push(`    Parameters:`);
					for (const param of op.param) {
						lines.push(`      - ${param.name} (${param.type}): ${param.dataType || 'any'}`);
						if (param.required) {
							lines.push(`        Required: true`);
						}
						if (param.defaultValue) {
							lines.push(`        Default: ${param.defaultValue}`);
						}
					}
				}

				if (op.responseMessage && op.responseMessage.length > 0) {
					lines.push(`    Responses:`);
					for (const resp of op.responseMessage) {
						lines.push(`      - ${resp.code}: ${resp.message}`);
						if (resp.contentType) {
							lines.push(`        Content-Type: ${resp.contentType}`);
						}
					}
				}

				if (op.security && op.security.length > 0) {
					lines.push(`    Security:`);
					for (const sec of op.security) {
						lines.push(`      - ${sec.key}${sec.scopes ? ` (${sec.scopes})` : ''}`);
					}
				}

				if (op.deprecated) {
					lines.push(`    DEPRECATED`);
				}

				lines.push(`    Route: ${op.routeId} -> ${op.to}`);
			}
		}
	}

	lines.push('\n=== ROUTES ===');

	for (const route of routes) {
		lines.push(`\nRoute: ${route.id}`);
		lines.push(`  From: ${route.from.uri}`);

		if (route.from.steps && route.from.steps.length > 0) {
			lines.push(`  Steps:`);
			for (const step of route.from.steps) {
				const stepType = Object.keys(step)[0];
				lines.push(`    - ${stepType}`);

				if (stepType === 'setBody' && 'setBody' in step) {
					const setBody = step.setBody;
					if (setBody && 'constant' in setBody) {
						lines.push(`      Value: ${setBody.constant}`);
					}
				}
			}
		}
	}

	return lines.join('\n');
}
