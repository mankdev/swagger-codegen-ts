import { array, flatten, last, uniq } from 'fp-ts/lib/Array';
import {
	TBodyParameterObject,
	TDictionary,
	TOperationObject,
	TParameterObject,
	TParametersDefinitionsObject,
	TPathItemObject,
	TPathParameterObject,
	TPathsObject,
	TQueryParameterObject,
	TReferenceObject,
	TSwaggerObject,
} from './swagger';
import { constant, Endomorphism, identity, tuple } from 'fp-ts/lib/function';
import { TFSEntity } from './fs';
import { camelize } from '@devexperts/utils/dist/string/string';
import { alt, chain, getOrElse, map, mapNullable, option, Option, some } from 'fp-ts/lib/Option';
import { eqString, getStructEq } from 'fp-ts/lib/Eq';
import { pipe } from 'fp-ts/lib/pipeable';

export type TSerializer = (name: string, schema: TSwaggerObject) => TFSEntity;

export const getOperationsFromPath = (path: TPathItemObject): TDictionary<TOperationObject> => {
	const result: TDictionary<TOperationObject> = {};
	const operations = array.compact([
		pipe(
			path.get,
			map(operation => tuple('get', operation)),
		),
		pipe(
			path.post,
			map(operation => tuple('post', operation)),
		),
		pipe(
			path.put,
			map(operation => tuple('put', operation)),
		),
		pipe(
			path.delete,
			map(operation => tuple('delete', operation)),
		),
		pipe(
			path.head,
			map(operation => tuple('head', operation)),
		),
		pipe(
			path.options,
			map(operation => tuple('options', operation)),
		),
		pipe(
			path.patch,
			map(operation => tuple('patch', operation)),
		),
	]);
	for (const [name, operation] of operations) {
		result[name] = operation;
	}
	return result;
};

export const getTagsFromPath = (path: TPathItemObject): string[] => {
	const operations = getOperationsFromPath(path);
	const tags = flatten(array.compact(Object.keys(operations).map(key => operations[key].tags)));
	return uniq(eqString)(tags);
};

const paramSetoid = getStructEq<TParameterObject | TReferenceObject>({
	name: eqString,
	$ref: eqString,
});

const addPathParametersToTag = (pathParams: Array<TParameterObject | TReferenceObject>) => (
	tagParams: Array<TParameterObject | TReferenceObject>,
): Array<TParameterObject | TReferenceObject> => uniq(paramSetoid)([...pathParams, ...tagParams]);

const resolveTagParameter = (fileParameters: TParametersDefinitionsObject) => (
	parameter: TParameterObject | TReferenceObject,
): Option<TParameterObject> => {
	if (!isOperationReferenceParameterObject(parameter)) {
		return some(parameter);
	}
	return pipe(
		last(parameter.$ref.split('/')),
		mapNullable(ref => fileParameters[ref]),
	);
};

const getTagWithResolvedParameters = (
	addPathParametersToTag: (
		tagParams: Array<TParameterObject | TReferenceObject>,
	) => Array<TParameterObject | TReferenceObject>,
	resolveTagParameter: (parameter: TParameterObject | TReferenceObject) => Option<TParameterObject>,
) => (tag: TOperationObject): TOperationObject => ({
	...tag,
	parameters: pipe(
		tag.parameters,
		alt(constant(some<Array<TParameterObject | TReferenceObject>>([]))),
		map(addPathParametersToTag),
		map(parameters => parameters.map(resolveTagParameter)),
		chain(array.sequence(option)),
	),
});

export const groupPathsByTag = (
	paths: TPathsObject,
	parameters: Option<TParametersDefinitionsObject>,
): TDictionary<TDictionary<TPathItemObject>> => {
	const keys = Object.keys(paths);
	const result: TDictionary<TDictionary<TPathItemObject>> = {};
	const resolveTagParam = pipe(
		parameters,
		map(resolveTagParameter),
	);
	for (const key of keys) {
		const path = paths[key];
		const pathParams = path.parameters;
		const addPathParamsToTag = pipe(
			pathParams,
			map(addPathParametersToTag),
		);
		const processTag = pipe(
			addPathParamsToTag,
			chain(addPathParamsToTag =>
				pipe(
					resolveTagParam,
					map(resolveTagParam => getTagWithResolvedParameters(addPathParamsToTag, resolveTagParam)),
				),
			),
			getOrElse(constant<Endomorphism<TOperationObject>>(identity)),
		);
		const pathWithParams: TPathItemObject = pipe(
			pathParams,
			map(() => ({
				...path,
				get: pipe(
					path.get,
					map(processTag),
				),
				post: pipe(
					path.post,
					map(processTag),
				),
				put: pipe(
					path.put,
					map(processTag),
				),
				delete: pipe(
					path.delete,
					map(processTag),
				),
			})),
			getOrElse(constant(path)),
		);
		const tags = getTagsFromPath(pathWithParams);
		const tag = camelize(tags.join('').replace(/\s/g, ''), false);

		result[tag] = {
			...(result[tag] || {}),
			[key]: pathWithParams,
		};
	}
	return result;
};

const isOperationReferenceParameterObject = (
	parameter: TParameterObject | TReferenceObject,
): parameter is TReferenceObject => typeof (parameter as any)['$ref'] === 'string';
const isOperationNonReferenceParameterObject = (
	parameter: TParameterObject | TReferenceObject,
): parameter is TParameterObject => !isOperationReferenceParameterObject(parameter);

const isPathParameterObject = (parameter: TParameterObject): parameter is TPathParameterObject =>
	parameter.in === 'path';
const isOperationPathParameterObject = (
	parameter: TParameterObject | TReferenceObject,
): parameter is TPathParameterObject =>
	isOperationNonReferenceParameterObject(parameter) && isPathParameterObject(parameter);
export const getOperationParametersInPath = (operation: TOperationObject): TPathParameterObject[] =>
	pipe(
		operation.parameters,
		map(parameters => parameters.filter(isOperationPathParameterObject)),
		getOrElse(constant<TPathParameterObject[]>([])),
	);

const isQueryParameterObject = (parameter: TParameterObject): parameter is TQueryParameterObject =>
	parameter.in === 'query';
const isOperationQueryParameterObject = (
	parameter: TParameterObject | TReferenceObject,
): parameter is TQueryParameterObject =>
	isOperationNonReferenceParameterObject(parameter) && isQueryParameterObject(parameter);
export const getOperationParametersInQuery = (operation: TOperationObject): TQueryParameterObject[] =>
	pipe(
		operation.parameters,
		map(parameters => parameters.filter(isOperationQueryParameterObject)),
		getOrElse(constant<TQueryParameterObject[]>([])),
	);

const isBodyParameterObject = (parameter: TParameterObject): parameter is TBodyParameterObject =>
	parameter.in === 'body';
const isOperationBodyParameterObject = (
	parameter: TParameterObject | TReferenceObject,
): parameter is TBodyParameterObject =>
	isOperationNonReferenceParameterObject(parameter) && isBodyParameterObject(parameter);
export const getOperationParametersInBody = (operation: TOperationObject): TBodyParameterObject[] =>
	pipe(
		operation.parameters,
		map(parameters => parameters.filter(isOperationBodyParameterObject)),
		getOrElse(constant<TBodyParameterObject[]>([])),
	);
