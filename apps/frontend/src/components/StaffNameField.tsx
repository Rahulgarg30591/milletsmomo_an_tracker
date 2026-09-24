import { Autocomplete, TextField } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getStaffNames } from '../api/staffApi';

interface StaffNameFieldProps {
  value: string;
  onChange: (name: string) => void;
  error?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

/**
 * Staff share one login, so a staff member is named by hand. Names used before
 * (in leaves or takeaways) are suggested so the same person is spelt one way.
 */
export default function StaffNameField({ value, onChange, error, size = 'medium', sx }: StaffNameFieldProps) {
  const { data: names = [] } = useQuery({
    queryKey: ['staffNames'],
    queryFn: getStaffNames,
    staleTime: 60_000,
  });

  return (
    <Autocomplete
      freeSolo
      options={names}
      inputValue={value}
      onInputChange={(_, v) => onChange(v)}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Staff name"
          placeholder="Who is it?"
          size={size}
          error={error}
          helperText={error ? 'Enter the staff member’s name' : undefined}
          inputProps={{ ...params.inputProps, maxLength: 60 }}
        />
      )}
      sx={sx}
    />
  );
}
