# Adding BWV639 as a Submodule with Sparse Checkout

This guide provides step-by-step instructions for adding the bwv639 repository as a submodule with sparse checkout to avoid downloading unnecessary files.

## Initial Setup (One-time)

### Step 1: Add the submodule
```bash
# From the bwv project root
cd bwv

# Add bwv639 as a submodule
git submodule add https://github.com/musicollator/bwv639.git bwv639
```

### Step 2: Configure sparse checkout
```bash
# Enter the submodule directory
cd bwv639

# Enable sparse checkout
git config core.sparseCheckout true
```

### Step 3: Define what files to include
```bash
# Go back to parent directory and configure the sparse-checkout
cd ..
echo "exports" > .git/modules/bwv639/info/sparse-checkout
```

### Step 4: Apply the sparse checkout
```bash
# Go back into the submodule and apply the configuration
cd bwv639
git read-tree -m -u HEAD
```

### Step 5: Commit the submodule
```bash
# Return to bwv project root
cd ..

# Add and commit the submodule
git add .gitmodules bwv639
git commit -m "Add bwv639 as submodule with sparse checkout"
```

## For New Clones

When someone clones the bwv project for the first time:

```bash
# Clone with submodules
git clone --recursive https://github.com/your-username/bwv.git
cd bwv

# Configure sparse checkout for bwv639
echo "exports" > .git/modules/bwv639/info/sparse-checkout
cd bwv639
git config core.sparseCheckout true
git read-tree -m -u HEAD
```

## Updating the Submodule

To update bwv639 to the latest version:

```bash
cd bwv/bwv639
git pull origin main
cd ..
git add bwv639
git commit -m "Update bwv639 submodule"
```

## Troubleshooting

If sparse checkout isn't working properly, try this sequence:

```bash
cd bwv/bwv639
git config core.sparseCheckout true
rm ../.git/modules/bwv639/info/sparse-checkout

# Recreate sparse-checkout file with exports directory only
echo "exports" > ../.git/modules/bwv639/info/sparse-checkout

# Force apply the configuration
git read-tree -m -u HEAD
git reset --hard HEAD
```

## Current Sparse Checkout Configuration

The submodule is configured to include only:
- `exports` - Exported files directory

All other files and directories are excluded from the local checkout.