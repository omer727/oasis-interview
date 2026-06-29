import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

const validPayload = {
  projectKey: 'TEST',
  title: 'Stale Service Account: svc-deploy-prod',
  description: 'Last active 90 days ago, still has prod write access',
  severity: 'high',
  findingType: 'stale-credential',
  identityType: 'service-account',
};

describe('POST /api/v1/findings', () => {
  it('returns 401 when X-API-Key header is missing', async () => {
    const res = await request(app).post('/api/v1/findings').send(validPayload);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when X-API-Key is wrong', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'wrong-key')
      .send(validPayload);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when severity is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'test-api-key-123')
      .send({ ...validPayload, severity: 'very-bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('severity');
  });

  it('returns 400 when title is empty', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'test-api-key-123')
      .send({ ...validPayload, title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when findingType is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'test-api-key-123')
      .send({ ...validPayload, findingType: 'unknown-type' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
