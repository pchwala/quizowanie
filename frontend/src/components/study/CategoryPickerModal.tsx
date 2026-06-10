import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  CircularProgress,
  IconButton,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useCategories } from '../../hooks/useCategories';

interface Props {
  open: boolean;
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

export default function CategoryPickerModal({ open, selected, onClose, onConfirm }: Props) {
  const { data: categories = [], isLoading } = useCategories();
  const [local, setLocal] = useState<string[]>(selected);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (open) setLocal(selected);
  }, [open, selected]);

  function toggle(id: string) {
    setLocal((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const topLevel = categories.filter((c) => c.parent_id === null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: fullScreen
            ? undefined
            : {
                m: 0,
                mt: 'auto',
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                maxHeight: '75vh',
              },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        Wybierz kategorie
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List dense disablePadding>
            {topLevel.map((cat) => {
              const checked = local.includes(cat.id);
              return (
                <ListItem key={cat.id} disablePadding>
                  <ListItemButton onClick={() => toggle(cat.id)}>
                    <Checkbox
                      checked={checked}
                      size="small"
                      sx={{ mr: 1, p: 0.5 }}
                      tabIndex={-1}
                      disableRipple
                    />
                    <ListItemText primary={cat.name} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          Anuluj
        </Button>
        <Button onClick={() => onConfirm(local)} variant="contained">
          Zatwierdź
        </Button>
      </DialogActions>
    </Dialog>
  );
}
