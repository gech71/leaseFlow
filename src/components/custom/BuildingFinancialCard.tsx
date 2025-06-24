
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

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Building className="h-5 w-5 text-primary" />
          <CardTitle className="font-headline text-lg text-foreground">{buildingName}</CardTitle>
        </div>
        <CardDescription className="text-xs">Summary for {periodDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm flex-grow">
        {/* Expenses */}
        <div className="flex items-center justify-between px-3 py-2 bg-red-100 dark:bg-red-900/30 rounded-md">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-700 dark:text-red-300 text-sm">Expenses:</span>
          </div>
          <span className="font-semibold text-red-700 dark:text-red-300 text-sm">
            {currentMonthExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
          </span>
        </div>

        {/* Income Section */}
        <div className="space-y-2 pt-2">
           <p className="text-sm text-muted-foreground font-semibold">Income:</p>
            {/* Collected */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700 dark:text-green-300 text-sm">Collected:</span>
              </div>
              <span className="font-medium text-green-700 dark:text-green-300 text-sm">
                {currentMonthIncomeCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
              </span>
            </div>
            {/* Pending */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
              <div className="flex items-center gap-2">
                 <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-300 text-sm">Pending:</span>
              </div>
              <span className="font-medium text-blue-700 dark:text-blue-300 text-sm">
                {currentMonthIncomePendingConfirmation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
              </span>
            </div>
            {/* Due */}
             <div className="flex items-center justify-between px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-700" />
                <span className="text-yellow-800 dark:text-yellow-300 text-sm">Due:</span>
              </div>
              <span className="font-medium text-yellow-800 dark:text-yellow-300 text-sm">
                {currentMonthIncomeToBeCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
              </span>
            </div>
        </div>
        
      </CardContent>
      <CardFooter className="border-t mt-auto pt-3 pb-3">
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
                <TrendingUp className={`h-5 w-5 ${netCurrentMonth >= 0 ? 'text-green-500' : 'text-destructive'}`} />
                <span className="text-sm font-semibold text-muted-foreground">Net:</span>
            </div>
            <span className={`text-base font-bold ${netCurrentMonth >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {netCurrentMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
            </span>
        </div>
      </CardFooter>
    </Card>
  );
}
