export type ToastMessage = {
  id: number;
  type: 'quest' | 'levelup' | 'login' | 'achievement' | 'error';
  title: string;
  message: string;
  icon?: string;
};

export const triggerToast = (
  type: 'quest' | 'levelup' | 'login' | 'achievement' | 'error',
  title: string,
  message: string,
  icon?: string
) => {
  const event = new CustomEvent('capingo-toast', { detail: { type, title, message, icon } });
  window.dispatchEvent(event);
};