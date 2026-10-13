package it.fplinio.myjournal;

// Variante 1x1 del widget "Nuova nota": stesso comportamento, solo testo.
public class NewNoteSmallWidget extends NewNoteWidget {
    @Override
    protected int layoutId() {
        return R.layout.widget_new_note_small;
    }
}
