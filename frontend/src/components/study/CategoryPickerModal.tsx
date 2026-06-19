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
  Chip,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from '@tanstack/react-query';
import { useCategories } from '../../hooks/useCategories';
import { getAvailableSources, getCategoryIdsForSources } from '../../local/questions';
import { type QuestionSource, SOURCE_LABELS } from '../../types/api';

interface Props {
  open: boolean;
  selected: string[];
  selectedSources: QuestionSource[];
  onClose: () => void;
  onConfirm: (sources: QuestionSource[], categoryIds: string[]) => void;
}

export default function CategoryPickerModal({
  open,
  selected,
  selectedSources,
  onClose,
  onConfirm,
}: Props) {
  const { data: categories = [], isLoading } = useCategories();
  const { data: availableSources = [] } = useQuery({
    queryKey: ['availableSources'],
    queryFn: getAvailableSources,
  });
  const [localCats, setLocalCats] = useState<string[]>(selected);
  const [localSources, setLocalSources] = useState<QuestionSource[]>(selectedSources);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (open) {
      setLocalCats(selected);
      setLocalSources(selectedSources);
    }
  }, [open, selected, selectedSources]);

  // Category ids that have questions in the selected sources (for narrowing).
  const { data: catIdSet } = useQuery({
    queryKey: ['catIdsForSources', [...localSources].sort()],
    queryFn: () => getCategoryIdsForSources(localSources),
    enabled: localSources.length > 0,
  });

  function toggleCategory(id: string) {
    setLocalCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSource(src: QuestionSource) {
    setLocalSources((prev) =>
      prev.includes(src) ? prev.filter((x) => x !== src) : [...prev, src],
    );
  }

  // Children grouped by parent, to decide whether a top-level category has any
  // questions in the selected sources (directly or via a child).
  const childrenOf = new Map<string, typeof categories>();
  for (const c of categories) {
    if (c.parent_id) {
      const list = childrenOf.get(c.parent_id) ?? [];
      list.push(c);
      childrenOf.set(c.parent_id, list);
    }
  }

  const topLevel = categories.filter((c) => c.parent_id === null);
  const narrowing = localSources.length > 0 && catIdSet !== undefined;
  const visibleTopLevel = !narrowing
    ? topLevel
    : topLevel.filter(
        (c) =>
          catIdSet.has(c.id) ||
          (childrenOf.get(c.id) ?? []).some((k) => catIdSet.has(k.id)),
      );
  const visibleIds = new Set(visibleTopLevel.map((c) => c.id));

  function handleConfirm() {
    // Drop any selected category that fell out of range under the source filter.
    const cats = narrowing ? localCats.filter((id) => visibleIds.has(id)) : localCats;
    onConfirm(localSources, cats);
  }

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
        Wybierz źródła i kategorie
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
          <>
            {availableSources.length > 0 && (
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                  Źródła
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }} useFlexGap>
                  {availableSources.map((src) => {
                    const active = localSources.includes(src);
                    return (
                      <Chip
                        key={src}
                        label={SOURCE_LABELS[src] ?? src}
                        size="small"
                        color={active ? 'primary' : 'default'}
                        variant={active ? 'filled' : 'outlined'}
                        onClick={() => toggleSource(src)}
                      />
                    );
                  })}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  {localSources.length === 0 ? 'Wszystkie źródła' : 'Kategorie ograniczone do wybranych źródeł'}
                </Typography>
              </Box>
            )}

            <List dense disablePadding>
              {visibleTopLevel.map((cat) => {
                const checked = localCats.includes(cat.id);
                return (
                  <ListItem key={cat.id} disablePadding>
                    <ListItemButton onClick={() => toggleCategory(cat.id)}>
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
              {visibleTopLevel.length === 0 && (
                <Typography color="text.secondary" sx={{ px: 2, py: 3, textAlign: 'center' }}>
                  Brak kategorii dla wybranych źródeł.
                </Typography>
              )}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          Anuluj
        </Button>
        <Button onClick={handleConfirm} variant="contained">
          Zatwierdź
        </Button>
      </DialogActions>
    </Dialog>
  );
}
