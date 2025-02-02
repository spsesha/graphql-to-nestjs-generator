import {
  parse,
  parseType,
  ObjectTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  FieldDefinitionNode,
  EnumTypeDefinitionNode,
  TypeNode,
  GraphQLError,
  Kind,
} from 'graphql';

const TYPE_MAPPING: { [key: string]: string } = {
  Int: 'number',
  Float: 'number',
  String: 'string',
  Boolean: 'boolean',
  ID: 'string',
};

type ObjectType = 'Query' | 'Mutation' | 'Subscription';

export function convertSDL(sdl: string): string {
  let result = '';

  try {
    const parsedData = parse(sdl);

    result = parsedData.definitions
      .map((def) => {
        if (def.kind === 'ObjectTypeDefinition') {
          return convertObjectType(def);
        } else if (def.kind === 'InputObjectTypeDefinition') {
          return convertObject(def, 'InputType');
        } else if (def.kind === 'EnumTypeDefinition') {
          return convertEnumType(def);
        }
      })
      .join('');
  } catch (error) {
    if (error instanceof GraphQLError) {
      result = convertField(sdl);
    } else {
      result = sdl;
    }
  }

  return result;
}

function isNullable(typeNode: TypeNode): boolean {
  return typeNode.kind !== 'NonNullType';
}

function isArray(typeNode: TypeNode): boolean {
  return typeNode.kind === 'ListType' || (typeNode.kind === 'NonNullType' && typeNode.type.kind === 'ListType');
}

function convertField(field: string): string {
  const split = field.split(':');
  if (split.length !== 2) {
    return field;
  }

  const fieldName = split[0].trim();
  const typeString = parseType(split[1].trim().split(' ')[0]);
  return convertFieldType({
    kind: Kind.FIELD_DEFINITION,
    name: {
      value: fieldName,
      kind: Kind.NAME,
    },
    type: typeString,
  });
}

function convertObjectType(node: ObjectTypeDefinitionNode): string {
  const typeString = node.name.value;
  if (['Query', 'Mutation', 'Subscription'].includes(typeString)) {
    return node.fields?.map((field) => convertSubObjectField(field, typeString as ObjectType)).join('');
  } else {
    return convertObject(node, 'ObjectType');
  }
}

function convertSubObjectField(field: FieldDefinitionNode, objectType: ObjectType): string {
  const returnType = convertType(field.type);
  const argsCode = field.arguments?.map(convertArgument).join(',\n') || '';

  return `@${objectType}(() => ${returnType})\n${field.name.value}(\n${argsCode}\n) {\n\n}\n\n`;
}

function convertObject(
  node: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode,
  objectType: 'ObjectType' | 'InputType'
): string {
  let classCode = `@${objectType}()\nexport class ${node.name.value}{\n`;
  classCode += node.fields?.map((field) => convertFieldType(field)).join('');
  classCode += '}\n\n';
  return classCode;
}

function convertFieldType(field: FieldDefinitionNode): string {
  const typeString = convertType(field.type);
  const nullable = isNullable(field.type) ? '?' : '';
  const isArrayType = isArray(field.type);
  const tsType = convertTypeScriptType(field.type);
  const decorator = `@Field(type => ${typeString}${nullable ? ', { nullable: true }' : ''})`;

  return `  ${decorator}\n  ${field.name.value}${nullable}: ${tsType};\n\n`;
}

function convertEnumType(node: EnumTypeDefinitionNode): string {
  let enumCode = `export enum ${node.name.value} {\n`;
  enumCode += node.values?.map((value) => `  ${value.name.value} = "${value.name.value}",\n`).join('');
  enumCode += '}\n\n';
  return enumCode;
}

function convertArgument(arg: any): string {
  const argType = convertType(arg.type);
  const nullable = isNullable(arg.type);

  return `@Args({ name: '${arg.name.value}', type: () => ${argType}${nullable ? ', nullable: true' : ''} }) ${
    arg.name.value
  }${nullable ? '?' : ''}: ${convertTypeScriptType(arg.type)}`;
}

function convertType(typeNode: TypeNode): string {
  if (typeNode.kind === 'NamedType') {
    return typeNode.name.value;
  } else if (typeNode.kind === 'ListType') {
    return `[${convertType(typeNode.type)}]`;
  } else {
    return convertType(typeNode.type);
  }
}

function convertTypeScriptType(typeNode: TypeNode): string {
  if (typeNode.kind === 'NamedType') {
    return TYPE_MAPPING[typeNode.name.value] || typeNode.name.value;
  } else if (typeNode.kind === 'ListType') {
    return `${convertTypeScriptType(typeNode.type)}[]`;
  } else {
    return convertTypeScriptType(typeNode.type);
  }
}
