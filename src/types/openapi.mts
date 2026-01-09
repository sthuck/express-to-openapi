// import { OpenAPIV3 } from "openapi-types";

export interface OpenAPISpec {
  openapi: string;
  info: InfoObject;
  paths: PathsObject;
  components?: ComponentsObject;
}

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
}

export interface PathsObject {
  [path: string]: PathItemObject;
}

export interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: ResponsesObject;
}

export interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  schema: SchemaObject | ReferenceObject;
  description?: string;
}

export interface RequestBodyObject {
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: SchemaObject | ReferenceObject;
    };
  };
}

export interface ComponentsObject {
  schemas?: {
    [key: string]: SchemaObject;
  };
}

export interface SchemaObject {
  type?: string;
  properties?: { [key: string]: SchemaObject | ReferenceObject };
  required?: string[];
  items?: SchemaObject | ReferenceObject;
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  description?: string;
  format?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enum?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ReferenceObject {
  $ref: string;
}

export interface ResponsesObject {
  [statusCode: string]: ResponseObject;
}

export interface ResponseObject {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: SchemaObject | ReferenceObject;
    };
  };
}
