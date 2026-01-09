import { getTypeScriptReader, getOpenApiWriter, makeConverter } from "typeconv";
import { OpenAPISpec, SchemaObject } from "../types/openapi.mjs";
import yaml from "js-yaml";

export async function convertTypeToSchema(
  typeText: string,
): Promise<SchemaObject> {
  // Wrap the type in an exported TypeScript type alias for typeconv
  // (typeconv only processes exported types)
  const tsSource = `export type T = ${typeText}`;

  try {
    // Create a converter from TypeScript to OpenAPI
    const reader = getTypeScriptReader();
    const writer = getOpenApiWriter({
      format: "yaml",
      title: "API",
      version: "1.0.0",
    });
    const converter = makeConverter(reader, writer);

    // Convert the TypeScript type to OpenAPI
    const result = await converter.convert({ data: tsSource });

    // Parse the YAML result
    const parsed: OpenAPISpec = yaml.load(result.data);

    // Extract the schema for type T from components.schemas
    if (parsed.components?.schemas?.T) {
      const schema = parsed.components.schemas.T as SchemaObject;
      // Clean up typeconv-added title fields
      return cleanSchema(schema);
    }

    // If no components, return empty object schema
    return { type: "object", properties: {} } as SchemaObject;
  } catch (error) {
    throw new Error(
      `Failed to convert TypeScript type to OpenAPI schema: ${error}`,
    );
  }
}

function cleanSchema(schema: SchemaObject): SchemaObject {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  // Remove typeconv-added title field
  const { title, ...cleaned } = schema;

  // Clean properties recursively
  if (cleaned.properties) {
    //TODO: see if can remove any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanedProps: any = {};
    for (const [key, value] of Object.entries(cleaned.properties)) {
      cleanedProps[key] = cleanSchema(value);
    }
    cleaned.properties = cleanedProps;
  } else if (cleaned.type === "object" && !cleaned.items) {
    // Add empty properties for object types without properties
    cleaned.properties = {};
  }

  // Clean array items recursively
  if (cleaned.items) {
    cleaned.items = cleanSchema(cleaned.items);
  }

  // Clean nested schemas in additionalProperties
  if (
    typeof cleaned.additionalProperties === "object" &&
    cleaned.additionalProperties !== null
  ) {
    cleaned.additionalProperties = cleanSchema(cleaned.additionalProperties);
  }

  return cleaned as SchemaObject;
}
