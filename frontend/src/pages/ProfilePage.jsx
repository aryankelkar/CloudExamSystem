import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Avatar, Grid, Chip, Alert, Divider,
} from '@mui/material';
import { Person, Email, Badge, HelpOutline, Edit, Save, Close } from '@mui/icons-material';
import { fsUpdateDoc } from '../firebase/firestore';
import { COLLECTIONS } from '../firebase/collections';
import { ROLES } from '../utils/constants';
import useAuth from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

const toRoleLabel = (rawRole) => {
  if (rawRole === ROLES.STUDENT) return 'Student';
  if (rawRole === ROLES.FACULTY) return 'Faculty';
  return 'Unknown';
};

const toRoleChipColor = (rawRole) => {
  if (rawRole === ROLES.STUDENT) return 'primary';
  if (rawRole === ROLES.FACULTY) return 'secondary';
  return 'default';
};

const toInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const ProfilePage = () => {
  const { currentUser, userProfile, loading } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name:  userProfile?.name  ?? '',
    email: userProfile?.email ?? '',
    role:  userProfile?.role  ?? '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name:  userProfile.name  ?? '',
        email: userProfile.email ?? '',
        role:  userProfile.role  ?? '',
      });
    }
  }, [userProfile]);

  if (loading) return <LoadingSpinner message="Loading profile..." />;

  const roleLabel     = toRoleLabel(formData.role);
  const roleChipColor = toRoleChipColor(formData.role);
  const initials      = toInitials(formData.name);
  const isUnknownRole = roleLabel === 'Unknown';

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await fsUpdateDoc(COLLECTIONS.USERS, currentUser.uid, {
        name: formData.name.trim(),
      });
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name:  userProfile?.name  ?? '',
      email: userProfile?.email ?? '',
      role:  userProfile?.role  ?? '',
    });
    setIsEditing(false);
    setError('');
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
          Profile
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B' }}>
          Manage your personal information
        </Typography>
      </Box>

      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12} md={8} lg={6}>
          <Paper sx={{ overflow: 'hidden' }}>
            {/* Profile header */}
            <Box
              sx={{
                p: 4,
                background: 'linear-gradient(160deg, #EEF2FF 0%, #F5F3FF 100%)',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <Avatar
                sx={{
                  width: 88,
                  height: 88,
                  mb: 2,
                  background: isUnknownRole
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(79,70,229,0.25)',
                }}
              >
                {initials}
              </Avatar>

              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.75 }}>
                {formData.name || 'No name set'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                {formData.email}
              </Typography>

              <Chip
                icon={isUnknownRole ? <HelpOutline fontSize="small" /> : <Badge fontSize="small" />}
                label={roleLabel}
                color={roleChipColor}
                sx={{ fontWeight: 600, px: 0.5 }}
              />
            </Box>

            {/* Form body */}
            <Box sx={{ p: 4 }}>
              {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
              {error   && <Alert severity="error"   sx={{ mb: 3 }}>{error}</Alert>}
              {isUnknownRole && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  Your account role is not configured. Please contact support.
                </Alert>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Full Name */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Person sx={{ fontSize: 16, color: '#94A3B8' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Full Name
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isEditing || saving}
                    size="small"
                    placeholder="Your full name"
                  />
                </Box>

                {/* Email */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Email sx={{ fontSize: 16, color: '#94A3B8' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Email Address
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    name="email"
                    value={formData.email}
                    disabled
                    size="small"
                    helperText="Email cannot be changed"
                  />
                </Box>

                {/* Role */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Badge sx={{ fontSize: 16, color: '#94A3B8' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Role
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    value={roleLabel}
                    disabled
                    size="small"
                    helperText={
                      isUnknownRole
                        ? 'Role could not be determined — contact support'
                        : 'Role is assigned at registration'
                    }
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 4 }} />

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                {isEditing ? (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<Close />}
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSave}
                      disabled={saving}
                      sx={{
                        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                        '&:hover': { background: 'linear-gradient(135deg, #4338CA, #6D28D9)' },
                      }}
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </Button>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
