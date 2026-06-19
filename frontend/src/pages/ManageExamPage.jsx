import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, IconButton, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tooltip,
} from '@mui/material';
import {
  Edit, Delete, Visibility, Add, Search,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAllExams, deleteExam } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatExamDate } from '../utils/examUtils';

const STATUS_CONFIG = {
  active:    { label: 'Active',    bg: '#DCFCE7', color: '#15803D' },
  upcoming:  { label: 'Upcoming',  bg: '#DBEAFE', color: '#1D4ED8' },
  completed: { label: 'Completed', bg: '#F1F5F9', color: '#475569' },
};

const ManageExamPage = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, examId: null });
  const [error, setError] = useState('');

  const loadExams = async () => {
    setLoading(true);
    try {
      const examsData = await getAllExams();
      setExams(examsData);
      setFiltered(examsData);
    } catch (err) {
      setError('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExams(); }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(exams);
    } else {
      const q = search.toLowerCase();
      setFiltered(exams.filter(
        (e) => e.title?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q)
      ));
    }
  }, [search, exams]);

  const handleDeleteConfirm = async () => {
    try {
      await deleteExam(deleteDialog.examId);
      setDeleteDialog({ open: false, examId: null });
      loadExams();
    } catch {
      setError('Failed to delete exam');
    }
  };

  if (loading) return <LoadingSpinner message="Loading exams..." />;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
            Manage Exams
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            {exams.length} exam{exams.length !== 1 ? 's' : ''} total
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/faculty/create-exam')}
          sx={{
            fontWeight: 600,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
          }}
        >
          Create Exam
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Search bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search exams by title or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ width: { xs: '100%', sm: 340 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: '#94A3B8', fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Exam</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Start Time</TableCell>
                <TableCell>End Time</TableCell>
                <TableCell>Questions</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                      {search ? 'No exams match your search.' : 'No exams found. Create your first exam!'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((exam) => {
                  const sc = STATUS_CONFIG[exam.status] || STATUS_CONFIG.completed;
                  return (
                    <TableRow key={exam.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {exam.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{exam.subject}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sc.label}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            backgroundColor: sc.bg,
                            color: sc.color,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatExamDate(exam.startTime)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatExamDate(exam.endTime)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {exam.questionCount ?? 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Edit exam">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/faculty/edit-exam/${exam.id}`)}
                              sx={{
                                color: '#64748B',
                                '&:hover': { color: '#4F46E5', backgroundColor: '#EEF2FF' },
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Preview exam">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/faculty/view-exam/${exam.id}`)}
                              sx={{
                                color: '#64748B',
                                '&:hover': { color: '#3B82F6', backgroundColor: '#EFF6FF' },
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete exam">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteDialog({ open: true, examId: exam.id })}
                              sx={{
                                color: '#64748B',
                                '&:hover': { color: '#EF4444', backgroundColor: '#FEF2F2' },
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, examId: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Delete Exam</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this exam? This action cannot be undone and all associated data will be removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteDialog({ open: false, examId: null })}
            sx={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteConfirm}
            sx={{
              flex: 1,
              backgroundColor: '#EF4444',
              '&:hover': { backgroundColor: '#DC2626' },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageExamPage;
