import { Node } from 'ts-morph';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteInfo {
  path: string;
  method: HttpMethod;
  handlerName?: string;
  handlerNode: Node;
}
