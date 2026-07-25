import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { leadsService } from "../../services/leads.service";
import type { Lead } from "../../utils/types";
import type { CreateLeadPayload, UpdateLeadPayload } from "../../types/lead.types";

interface LeadsState {
  items: Lead[];
  selectedLead: Lead | null;
  status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: LeadsState = {
  items: [],
  selectedLead: null,
  status: "idle",
};

export const fetchLeads = createAsyncThunk("leads/fetch", leadsService.getLeads);

export const createLeadThunk = createAsyncThunk(
  "leads/create",
  async (payload: CreateLeadPayload) => {
    const response = await leadsService.create(payload);
    return response.data;
  }
);

const extractErrorMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

export const updateLeadThunk = createAsyncThunk(
  "leads/update",
  async ({ id, payload }: { id: string; payload: UpdateLeadPayload }, { rejectWithValue }) => {
    try {
      const response = await leadsService.update(id, payload);
      return response.data;
    } catch (err) {
      return rejectWithValue(extractErrorMsg(err, "Failed to update lead."));
    }
  }
);

export const deleteLeadThunk = createAsyncThunk(
  "leads/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await leadsService.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(extractErrorMsg(err, "Failed to delete lead."));
    }
  }
);

export const regenerateSummaryThunk = createAsyncThunk(
  "leads/regenerateSummary",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await leadsService.regenerateSummary(id);
      return response.data;
    } catch (err) {
      return rejectWithValue(extractErrorMsg(err, "Failed to regenerate summary."));
    }
  }
);

export const updateLeadStageThunk = createAsyncThunk(
  "leads/updateStage",
  async ({ leadId, stage }: { leadId: string; stage: Lead["stage"] }, { rejectWithValue }) => {
    try {
      return await leadsService.updateLeadStage(leadId, stage);
    } catch (err) {
      return rejectWithValue(extractErrorMsg(err, "Failed to update stage."));
    }
  }
);

const leadsSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    selectLead(state, action: PayloadAction<Lead | null>) {
      state.selectedLead = action.payload;
    },
    patchLead(state, action: PayloadAction<Partial<Lead> & { id: string }>) {
      const idx = state.items.findIndex((l) => l.id === action.payload.id);
      if (idx !== -1) state.items[idx] = { ...state.items[idx], ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchLeads.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload as unknown as Lead[];
      })
      .addCase(fetchLeads.rejected, (state) => {
        state.status = "failed";
      })
      // create
      .addCase(createLeadThunk.fulfilled, (state, action) => {
        state.items.unshift(action.payload as unknown as Lead);
      })
      // update
      .addCase(updateLeadThunk.fulfilled, (state, action) => {
        const updated = action.payload as unknown as Lead;
        const idx = state.items.findIndex((l) => l.id === updated.id);
        if (idx !== -1) state.items[idx] = updated;
        if (state.selectedLead?.id === updated.id) state.selectedLead = updated;
      })
      // delete
      .addCase(deleteLeadThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((l) => l.id !== action.payload);
        if (state.selectedLead?.id === action.payload) state.selectedLead = null;
      })
      // updateStage
      .addCase(updateLeadStageThunk.fulfilled, (state, action) => {
        const updated = action.payload as Lead;
        const idx = state.items.findIndex((l) => l.id === updated.id);
        if (idx !== -1) state.items[idx] = updated;
        if (state.selectedLead?.id === updated.id) state.selectedLead = updated;
      })
      // regenerateSummary
      .addCase(regenerateSummaryThunk.fulfilled, (state, action) => {
        const updated = action.payload as Lead;
        const idx = state.items.findIndex((l) => l.id === updated.id);
        if (idx !== -1) state.items[idx] = updated;
        if (state.selectedLead?.id === updated.id) state.selectedLead = updated;
      });
  },
});

export const { selectLead, patchLead } = leadsSlice.actions;
export default leadsSlice.reducer;
