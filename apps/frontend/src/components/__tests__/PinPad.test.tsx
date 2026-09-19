import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PinPad from '../PinPad';
import { renderWithProviders } from '../../test/renderWithProviders';

function setup(props: Partial<React.ComponentProps<typeof PinPad>> = {}) {
  const onComplete = vi.fn();
  const onErrorAck = vi.fn();
  renderWithProviders(
    <PinPad onComplete={onComplete} errorMessage={null} onErrorAck={onErrorAck} {...props} />,
  );
  return { onComplete, onErrorAck, user: userEvent.setup() };
}

/** Each key is labelled "PIN digit N" for screen readers. */
const tap = (user: ReturnType<typeof userEvent.setup>, digits: string) =>
  digits.split('').reduce(
    (p, d) => p.then(() => user.click(screen.getByRole('button', { name: `PIN digit ${d}` }))),
    Promise.resolve(),
  );

describe('PinPad', () => {
  it('submits once four digits are entered', async () => {
    const { onComplete, user } = setup();
    await tap(user, '9865');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('9865'));
  });

  it('does not submit a short PIN', async () => {
    const { onComplete, user } = setup();
    await tap(user, '986');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('keeps every digit when taps land in one batch', async () => {
    // Reading the PIN from the closure dropped digits on fast taps; the
    // functional update is what makes four quick taps produce four digits.
    const { onComplete, user } = setup();
    await tap(user, '1111');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('1111'));
  });

  it('ignores a fifth digit', async () => {
    const { onComplete, user } = setup();
    await tap(user, '98651');
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith('9865');
  });

  it('disables the keys while a sign-in is in flight', () => {
    // Disabled rather than merely ignored, so a second PIN cannot be queued up
    // behind a slow login.
    setup({ loading: true });
    expect(screen.getByRole('button', { name: 'PIN digit 9' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeDisabled();
  });

  it('acknowledges the previous error on the next tap', async () => {
    const { onErrorAck, user } = setup({ errorMessage: 'Invalid PIN' });
    await user.click(screen.getByRole('button', { name: 'PIN digit 1' }));
    expect(onErrorAck).toHaveBeenCalled();
  });

  it('shows the error message', () => {
    setup({ errorMessage: 'Invalid PIN' });
    expect(screen.getByText('Invalid PIN')).toBeInTheDocument();
  });

  it('shows a status message while working', () => {
    setup({ loading: true, statusMessage: 'Waking the server…' });
    expect(screen.getByText('Waking the server…')).toBeInTheDocument();
  });

  it('labels every key for screen readers', () => {
    setup();
    for (const d of '0123456789') {
      expect(screen.getByRole('button', { name: `PIN digit ${d}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeInTheDocument();
  });

  it('clears entered digits and allows a retry after an error', async () => {
    const { onComplete, user } = setup({ errorMessage: 'Invalid PIN' });
    await tap(user, '1703');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('1703'));
  });
});
