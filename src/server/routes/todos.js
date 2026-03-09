/**
 * 待办 API 路由：CRUD + 排序列表
 */
const express = require('express');
const todoService = require('../services/todoService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date).trim().slice(0, 10) : undefined;
    const list = todoService.getAll(date);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/list', (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'score';
    const scoreFactor = req.query.scoreFactor != null ? Number(req.query.scoreFactor) : 0.33;
    const date = req.query.date ? String(req.query.date).trim().slice(0, 10) : undefined;
    const list = todoService.getList(sortBy, scoreFactor, date);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/deadline-warnings', (req, res) => {
  try {
    const list = todoService.getDeadlineWarnings();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/expired', (req, res) => {
  try {
    const list = todoService.getExpiredTodos();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/day-stats', (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date).trim().slice(0, 10) : undefined;
    const stats = todoService.getDayStats(date);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  const item = todoService.getById(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json(item);
});

router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    const item = todoService.create(body);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const item = todoService.updateById(req.params.id, req.body || {});
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const ok = todoService.deleteById(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
});

module.exports = router;
