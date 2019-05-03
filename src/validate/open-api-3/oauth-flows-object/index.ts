import { Option } from 'fp-ts/lib/Option';
import { intersection, record, string, type } from 'io-ts';
import { createOptionFromNullable } from 'io-ts-types';

// https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#oauthFlowObject
type AuthorizationURL = { authorizationUrl: string };
const authorizationURLIO = type({ authorizationUrl: string });

type TokenURL = { tokenUrl: string };
const tokenURLIO = type({ tokenUrl: string });

type RefreshURLAndScopes = {
	refreshUrl: Option<string>;
	scopes: Record<string, string>;
};
const refreshURLAndScopesIO = type({
	refreshUrl: createOptionFromNullable(string),
	scopes: record(string, string),
});

// https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#oauthFlowsObject
export type OAuthFlowsObject = {
	authorizationCode: Option<RefreshURLAndScopes & TokenURL & AuthorizationURL>;
	clientCredentials: Option<RefreshURLAndScopes & TokenURL>;
	implicit: Option<RefreshURLAndScopes & AuthorizationURL>;
	password: Option<RefreshURLAndScopes & TokenURL>;
};
export const oauthFlowsObjectIO = type(
	{
		authorizationCode: createOptionFromNullable(
			intersection([refreshURLAndScopesIO, tokenURLIO, authorizationURLIO]),
		),
		clientCredentials: createOptionFromNullable(intersection([refreshURLAndScopesIO, tokenURLIO])),
		implicit: createOptionFromNullable(intersection([refreshURLAndScopesIO, authorizationURLIO])),
		password: createOptionFromNullable(intersection([refreshURLAndScopesIO, tokenURLIO])),
	},
	'OAuthFlowsObject',
);
