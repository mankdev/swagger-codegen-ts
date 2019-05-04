import { Option } from 'fp-ts/lib/Option';
import { OAuthFlowsObject, oauthFlowsObjectIO } from '../oauth-flows-object';
import { intersection, literal, string, type, union } from 'io-ts';
import { createOptionFromNullable } from 'io-ts-types';

// https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#securitySchemeObject
type SecuritySchemeApiKey = {
	type: 'apiKey';
	name: string;
	in: string;
};
const securitySchemeApiKey = type({
	type: literal('apiKey'),
	name: string,
	in: string,
});

type SecuritySchemeHTTP = {
	type: 'http';
	scheme: string;
	bearerFormat: Option<string>;
};
const securitySchemeHTTP = type({
	type: literal('http'),
	scheme: string,
	bearerFormat: createOptionFromNullable(string),
});

type SecuritySchemeOAuth2 = {
	type: 'oauth2';
	flows: OAuthFlowsObject;
};
const securitySchemeOAuth2 = type({
	type: literal('oauth2'),
	flows: oauthFlowsObjectIO,
});

type SecuritySchemeOpenIdConnect = {
	type: 'openIdConnect';
	openIdConnectUrl: string;
};
const securitySchemeOpenIdConnect = type({
	type: literal('openIdConnect'),
	openIdConnectUrl: string,
});

export type SecuritySchemeObject = (
	| SecuritySchemeApiKey
	| SecuritySchemeHTTP
	| SecuritySchemeOAuth2
	| SecuritySchemeOpenIdConnect) & {
	description: Option<string>;
};
export const securitySchemeObjectIO = intersection(
	[
		union([securitySchemeApiKey, securitySchemeHTTP, securitySchemeOAuth2, securitySchemeOpenIdConnect]),
		type({ description: createOptionFromNullable(string) }),
	],
	'SecuritySchemeObject',
);
