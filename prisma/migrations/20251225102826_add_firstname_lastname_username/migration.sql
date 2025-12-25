-- AlterTable: Add new columns
ALTER TABLE "User" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Update existing users to have a default username based on email
UPDATE "User" SET "username" = SPLIT_PART("email", '@', 1) WHERE "username" IS NULL;

-- Make username required after setting defaults
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- Drop the old name column (no longer needed)
ALTER TABLE "User" DROP COLUMN "name";

