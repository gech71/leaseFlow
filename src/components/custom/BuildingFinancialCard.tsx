
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building, DollarSign, TrendingUp, AlertCircle, Clock, CheckCircle } from "lucide-react";

interface BuildingFinancialCardProps {
  buildingName: string;
  currentMonthExpenses: number;
  currentMonthIncomeCollected: number;
  currentMonthIncomePendingConfirmation: number;
  currentMonthIncomeToBeCollected: number;
  periodDescription: string;
}

export function BuildingFinancialCard({
  buildingName,
  currentMonthExpenses,
  currentMonthIncomeCollected,
  currentMonthIncomePendingConfirmation,
  currentMonthIncomeToBeCollected,
  periodDescription,
}: BuildingFinancialCardProps) {
  const netCurrentMonth = currentMonthIncomeCollected - currentMonthExpenses;

  // Helper for formatting numbers
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Birr";
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Building className="h-5 w-5 text-primary" />
          <CardTitle className="font-headline text-lg text-foreground">{buildingName}</CardTitle>
        </div>
        <CardDescription className="text-xs">Summary for {periodDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm flex-grow">
        {/* Expenses */}
        <div className="flex items-center justify-between px-3 py-2 bg-red-100/60 dark:bg-red-900/30 rounded-md">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-700 dark:text-red-300 text-sm">Expenses:</span>
          </div>
          <span className="font-semibold text-red-800 dark:text-red-200 text-sm">
            {formatCurrency(currentMonthExpenses)}
          </span>
        </div>

        {/* Income Section */}
        <div className="space-y-2 pt-2">
           <p className="text-sm text-muted-foreground font-medium mb-2">Income:</p>
            {/* Collected */}
            <div className="flex items-center justify-between px-3 py-2 bg-green-100/60 dark:bg-green-900/30 rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700 dark:text-green-300 text-sm font-medium">Collected:</span>
              </div>
              <span className="font-medium text-green-800 dark:text-green-200 text-sm">
                {formatCurrency(currentMonthIncomeCollected)}
              </span>
            </div>
            {/* Pending */}
            <div className="flex items-center justify-between px-3 py-2 bg-blue-100/60 dark:bg-blue-900/30 rounded-md">
              <div className="flex items-center gap-2">
                 <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">Pending:</span>
              </div>
              <span className="font-medium text-blue-800 dark:text-blue-200 text-sm">
                {formatCurrency(currentMonthIncomePendingConfirmation)}
              </span>
            </div>
            {/* Due */}
             <div className="flex items-center justify-between px-3 py-2 bg-yellow-100/60 dark:bg-yellow-900/30 rounded-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-700" />
                <span className="text-yellow-800 dark:text-yellow-300 text-sm font-medium">Due:</span>
              </div>
              <span className="font-medium text-yellow-900 dark:text-yellow-200 text-sm">
                {formatCurrency(currentMonthIncomeToBeCollected)}
              </span>
            </div>
        </div>
      </CardContent>
      <CardFooter className="border-t mt-auto pt-4 pb-4">
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
                <TrendingUp className={`h-5 w-5 ${netCurrentMonth >= 0 ? 'text-green-500' : 'text-destructive'}`} />
                <span className="text-sm font-semibold text-muted-foreground">Net:</span>
            </div>
            <span className={`text-base font-bold ${netCurrentMonth >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(netCurrentMonth)}
            </span>
        </div>
      </CardFooter>
    </Card>
  );
}
