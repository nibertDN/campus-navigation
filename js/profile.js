import { storage } from './storage.js';
import { showToast } from './notifications.js';

const defaultProfile = {
  name: '',
  studentId: '',
  course: '',
  year: '1',
  profileImage: '',
};

export function setupProfilePage() {
  const form = document.getElementById('profileForm');
  const profileImageInput = document.getElementById('profileImage');
  const profileImagePreview = document.getElementById('profileImagePreview');
  const summary = document.getElementById('profileSummary');
  if (!form || !profileImageInput || !profileImagePreview || !summary) return;

  const savedProfile = storage.get('campusUserProfile', defaultProfile);
  populateProfile(savedProfile, form, profileImagePreview, summary);
  renderAccountSidebar();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = {
      name: document.getElementById('profileName').value.trim(),
      studentId: document.getElementById('profileId').value.trim(),
      course: document.getElementById('profileCourse').value.trim(),
      year: document.getElementById('profileYear').value,
      profileImage: profileImageInput.value.trim(),
    };

    storage.set('campusUserProfile', profile);
    populateProfile(profile, form, profileImagePreview, summary);
    renderAccountSidebar();
    showToast('Profile saved', 'Your profile information is stored locally.', 'success');
  });

  profileImageInput.addEventListener('input', () => {
    const url = profileImageInput.value.trim();
    if (url) profileImagePreview.innerHTML = `<img src="${url}" alt="Profile image" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  });
}

export function renderAccountSidebar() {
  const avatar = document.getElementById('accountAvatar');
  const nameEl = document.getElementById('accountName');
  const metaEl = document.getElementById('accountMeta');
  if (!avatar && !nameEl && !metaEl) return;

  const profile = storage.get('campusUserProfile', defaultProfile);
  const image = (profile.profileImage || '').trim();

  if (avatar) {
    avatar.innerHTML = image ? `<img src="${image}" alt="Profile picture" />` : '👤';
  }
  if (nameEl) nameEl.textContent = profile.name || 'Guest user';
  if (metaEl) {
    metaEl.textContent =
      profile.studentId && profile.course
        ? `${profile.course} • ID ${profile.studentId}`
        : profile.course || (profile.studentId ? `Student ID ${profile.studentId}` : 'Personalize your campus portal');
  }
}

function populateProfile(profile, form, preview, summary) {
  document.getElementById('profileName').value = profile.name || '';
  document.getElementById('profileId').value = profile.studentId || '';
  document.getElementById('profileCourse').value = profile.course || '';
  document.getElementById('profileYear').value = profile.year || '1';
  document.getElementById('profileImage').value = profile.profileImage || '';
  if (profile.profileImage) {
    preview.innerHTML = `<img src="${profile.profileImage}" alt="Profile image" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  } else {
    preview.innerHTML = '👤';
  }
  summary.textContent = profile.name ? `${profile.name} • ${profile.course} • Year ${profile.year}` : 'Your stored profile will appear here after saving.';
}
