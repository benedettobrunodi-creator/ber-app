import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export function list(req: Request, res: Response) {
  return service.list({
    discipline: req.query.discipline as string | undefined,
    search: req.query.search as string | undefined,
    status: req.query.status as string | undefined,
  }).then(data => sendSuccess(res, data));
}

export function getById(req: Request, res: Response) {
  return service.getById(req.params.id)
    .then(data => sendSuccess(res, data));
}

export function create(req: Request, res: Response) {
  return service.create(req.user!.userId, req.body)
    .then(data => sendCreated(res, data));
}

export function update(req: Request, res: Response) {
  return service.update(req.params.id, req.user!.userId, req.body)
    .then(data => sendSuccess(res, data));
}

export function publish(req: Request, res: Response) {
  return service.publish(req.params.id, req.user!.userId, req.body.status)
    .then(data => sendSuccess(res, data));
}

export function bulk(req: Request, res: Response) {
  return service.bulkUpsert(req.user!.userId, req.body)
    .then(data => sendCreated(res, data));
}
